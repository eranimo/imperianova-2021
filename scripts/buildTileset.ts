#!/usr/bin/env ts-node

import Jimp from "jimp";
import path from 'path';
import fs from 'fs';
import { TerrainType, terrainTransitions, terrainTypeTitles, TerrainTypeMap } from '../src/terrain';
import { Direction, Corner, ColorArray, Coord, Rect, DirectionMap, CoordArray, Size } from '../src/types';
import { newImage } from "./imageUtils";
import { performance } from 'perf_hooks';
import { TileGen, TileQuery } from './TileGen';
import { terrainTypePrimaryColors, controlPoints, tileColorTransition } from './settings';
import { TileSectionType, HexTileSectionVariant, TileSectionEdge, HexTileSection, TileSectionEdgeMap, SectionControlPoint, TileSectionTypeMap, getSectionTileID, TilesetDefinition, sectionTypeEdges, centerTypeEdges } from '../src/hexTile';
import cliProgress from 'cli-progress';
import { midpoint, rotatePoint, getNeighbors, midpointPoints, randomizePoint, randomizeColor, randomizeColorBrightness, getPositionAlongTheLine } from '../src/utils';
import { randomizedPattern, noisyPattern, wavyPattern } from './patternGenerator';
import Alea from 'alea';
import { groupBy, isNumber } from "lodash";

const SEED = 123;

const baseTerrainTypes = [
  TerrainType.OCEAN,
  TerrainType.COAST,
  TerrainType.GRASSLAND,
  TerrainType.FOREST,
  TerrainType.DESERT,
  TerrainType.TAIGA,
  TerrainType.TUNDRA,
  TerrainType.GLACIAL,
];

const roadTerrainTypes = [
  TerrainType.GRASSLAND,
  TerrainType.FOREST,
  TerrainType.DESERT,
  TerrainType.TAIGA,
  TerrainType.TUNDRA,
  TerrainType.RIVER,
  TerrainType.GLACIAL,
]

const waterTerrainTypes = [
  TerrainType.OCEAN,
  TerrainType.COAST,
];

const tileSectionTypeIndexOrder = [
  TileSectionType.CENTER,
  TileSectionType.SE,
  TileSectionType.NE,
  TileSectionType.N,
  TileSectionType.NW,
  TileSectionType.SW,
  TileSectionType.S,
];

const edgeToCenterControlPoint = {
  [TileSectionEdge.SE]: SectionControlPoint.SE,
  [TileSectionEdge.NE]: SectionControlPoint.NE,
  [TileSectionEdge.N]: SectionControlPoint.N,
  [TileSectionEdge.NW]: SectionControlPoint.NW,
  [TileSectionEdge.SW]: SectionControlPoint.SW,
  [TileSectionEdge.S]: SectionControlPoint.S,
  [TileSectionEdge.CENTER]: SectionControlPoint.INSIDE_CENTER,
  [TileSectionEdge.ADJ1]: SectionControlPoint.ADJ1_MED,
  [TileSectionEdge.ADJ2]: SectionControlPoint.ADJ2_MED,
  [TileSectionEdge.EDGE]: SectionControlPoint.EDGE_CENTER,
};

type PatternFunc = (query: TileQuery, size: Size, rng: () => number) => void;
const terrainPatterns: Partial<Record<TerrainType, PatternFunc>> = {
  // [TerrainType.DESERT]: (query, size, rng) => {
  //   query.applyPattern(wavyPattern(rng, size, 0, 15, 15));
  // },
  // [TerrainType.GRASSLAND]: (query, size, rng) => {
  //   query.applyPattern(noisyPattern(rng, 0.30));
  // }
};

const assetFolder = path.resolve(__dirname, '..', 'src', 'assets');

const tileWidth = 64;
const tileHeight = 60;
const tileOffset = 10;
const tileSize = {
  width: tileWidth,
  height: tileHeight + tileOffset,
};
const templateTileWidth = 64;
const templateTileHeight = 60;
const tilePadding = 10;
const columns = 50;

const sectionTypeColors: TileSectionTypeMap<ColorArray> = {
  [TileSectionType.CENTER]: [69, 69, 69],
  [TileSectionType.SE]: [64, 191, 148],
  [TileSectionType.NE]: [191, 134, 64],
  [TileSectionType.N]: [67, 191, 64],
  [TileSectionType.NW]: [64, 71, 191],
  [TileSectionType.SW]: [144, 64, 191],
  [TileSectionType.S]: [191, 64, 64],
}

const sectionTemplateIndex: TileSectionTypeMap<number> = {
  [TileSectionType.CENTER]: 1,
  [TileSectionType.SE]: 2,
  [TileSectionType.NE]: 7,
  [TileSectionType.N]: 6,
  [TileSectionType.NW]: 5,
  [TileSectionType.SW]: 4,
  [TileSectionType.S]: 3,
}

const sectionTemplates: Partial<Record<TileSectionType, Jimp>> = {};

const tileSectionRects: Partial<Record<TileSectionType, Rect>> = {};
for (const section of tileSectionTypeIndexOrder) {
  const [x, y] = getTileCoords(sectionTemplateIndex[section], 8, templateTileWidth, templateTileHeight, 0);
  tileSectionRects[section] = {
    x, y,
    width: tileWidth,
    height: tileHeight
  };
}

function getTileCoords(
  index: number,
  columns: number,
  tileWidth: number,
  tileHeight: number,
  padding: number,
): Coord {
  return [
    (index % columns) * (tileWidth + padding),
    (Math.floor(index / columns)) * (tileHeight + padding),
  ];
}

function getTerrainTransitions(terrainType: TerrainType) {
  return new Set(terrainTransitions[terrainType] || []);
}

function getCommonTerrainTransitions(t1: TerrainType, t2: TerrainType) {
  const t1Transitions = getTerrainTransitions(t1);
  const t2Transitions = getTerrainTransitions(t2);
  // const set = new Set([...t1Transitions].filter(x => t2Transitions.has(x)));
  const set = new Set([
    ...t1Transitions,
    ...t2Transitions,
  ]);
  return set;
}

function isRiverTerrain(terrainType) {
  return (
    terrainType === TerrainType.RIVER ||
    terrainType === TerrainType.RIVER_SOURCE ||
    terrainType === TerrainType.RIVER_MOUTH
  )
}

function createTileDefs(): HexTileSectionVariant[] {
  const tiles: HexTileSection[] = [];

  for (const terrainType of baseTerrainTypes) {
    console.log(`Terrain: ${terrainTypeTitles[terrainType]}`);
    const terrainTypeTransitions = getTerrainTransitions(terrainType);

    // base tiles
    let count = 0;
    for (const sectionType of tileSectionTypeIndexOrder) {
      let edgeTerrainTypes: Partial<TileSectionEdgeMap<TerrainType>>;
      // center sections do not have transitions
      const sectionEdgeTypes = sectionTypeEdges[sectionType];
      if (sectionType !== TileSectionType.CENTER) {
        edgeTerrainTypes = {};
        for (const edgeType of sectionEdgeTypes) {
          edgeTerrainTypes[edgeType] = terrainType;
        }
      }
      tiles.push({
        type: sectionType,
        terrainType,
        edgeTerrainTypes: edgeTerrainTypes as TileSectionEdgeMap<TerrainType>,
      });
      count++;

      // ROADS
      if (roadTerrainTypes.includes(terrainType)) { 
        if (sectionType === TileSectionType.CENTER) {
          // center sections have road variants for each edge
          for (let road_se = 0; road_se < 2; road_se++) {
            for (let road_ne = 0; road_ne < 2; road_ne++) {
              for (let road_n = 0; road_n < 2; road_n++) {
                for (let road_nw = 0; road_nw < 2; road_nw++) {
                  for (let road_sw = 0; road_sw < 2; road_sw++) {
                    for (let road_s = 0; road_s < 2; road_s++) {
                      if (
                        !(road_se === 0 && road_ne === 0 && road_n === 0 &&
                        road_nw === 0 && road_sw === 0 && road_s === 0)
                      ) {
                        tiles.push({
                          type: sectionType,
                          terrainType,
                          edgeTerrainTypes: edgeTerrainTypes as TileSectionEdgeMap<TerrainType>,
                          edgeRoads: {
                            [TileSectionEdge.SE]: Boolean(road_se),
                            [TileSectionEdge.NE]: Boolean(road_ne),
                            [TileSectionEdge.N]: Boolean(road_n),
                            [TileSectionEdge.NW]: Boolean(road_nw),
                            [TileSectionEdge.SW]: Boolean(road_sw),
                            [TileSectionEdge.S]: Boolean(road_s),
                          } as any,
                        });
                        count++;
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          // edge sections only have a road between the edge and center
          tiles.push({
            type: sectionType,
            terrainType,
            edgeTerrainTypes,
            edgeRoads: {
              [TileSectionEdge.CENTER]: true,
              [TileSectionEdge.EDGE]: true,
            }
          });
          count++;
        }
      }
    }
    console.log(`\tAdded ${count} base variants`);
    
    // edge section transitions
    const edgeTerrainTransitions = terrainTypeTransitions;
    edgeTerrainTransitions.add(terrainType);
    if (terrainType !== TerrainType.OCEAN && terrainType !== TerrainType.COAST) {
      edgeTerrainTransitions.add(TerrainType.RIVER);
    }
    if (edgeTerrainTransitions.size > 0) {
      console.log(`\tAdding transitions:`, Array.from(terrainTypeTransitions).map(t => terrainTypeTitles[t]).join(', '));
      let count = 0;
      for (const sectionType of tileSectionTypeIndexOrder) {
        if (sectionType !== TileSectionType.CENTER) {
          for (const edgeTerrainType of edgeTerrainTransitions) {
            // only create side terrain variants for terrain types the hex terrain type has in common with the edge terrain type
            const sideTerrainTransitions = getCommonTerrainTransitions(terrainType, edgeTerrainType);
            sideTerrainTransitions.add(terrainType);
            sideTerrainTransitions.add(edgeTerrainType);
            if (terrainType === TerrainType.COAST) {
              sideTerrainTransitions.add(TerrainType.RIVER_MOUTH);
            }
            if (
              !waterTerrainTypes.includes(terrainType) &&
              edgeTerrainType !== TerrainType.RIVER
            ) {
              sideTerrainTransitions.add(TerrainType.RIVER);
              sideTerrainTransitions.add(TerrainType.RIVER_SOURCE);
            }
            console.log('\tside transitions:', Array.from(sideTerrainTransitions).map(t => terrainTypeTitles[t]).join(', '));
            for (const adj1TerrainType of sideTerrainTransitions) {
              for (const adj2TerrainType of sideTerrainTransitions) {
                console.log(`\t (section: ${sectionType}) edge: ${terrainTypeTitles[edgeTerrainType]}\t - adj1: ${terrainTypeTitles[adj1TerrainType]} \t adj2: ${terrainTypeTitles[adj2TerrainType]}`);
                // rivers only on land
                const edgeTerrainTypes = {
                  [TileSectionEdge.CENTER]: terrainType,
                  [TileSectionEdge.EDGE]: edgeTerrainType,
                  [TileSectionEdge.ADJ1]: adj1TerrainType,
                  [TileSectionEdge.ADJ2]: adj2TerrainType,
                };
                tiles.push({
                  type: sectionType,
                  terrainType,
                  edgeTerrainTypes
                });

                // edge tiles only have straight roads
                if (
                  roadTerrainTypes.includes(terrainType) &&
                  roadTerrainTypes.includes(edgeTerrainType)
                ) {
                  tiles.push({
                    type: sectionType,
                    terrainType,
                    edgeTerrainTypes,
                    edgeRoads: {
                      [TileSectionEdge.CENTER]: true,
                      [TileSectionEdge.EDGE]: true,
                    }
                  });
                }

                count++;
              }
            }
          }
        }
      }
      console.log(`\tAdded ${count} transition variants`);
    } else {
      console.log(`\tNo transitions for type`);
    }

    console.log('\n');
  }

  const tileVariants = tiles.map(tile => {
    const id = getSectionTileID(tile);
    const seed = SEED;
    return {
      id,
      seed,
      tile,
    };
  });

  for (const [id, tiles] of Object.entries(groupBy(tileVariants, 'id'))) {
    if (tiles.length > 1) {
      console.error(`Multiple tiles with ID ${id}`);
    }
  }

  return tileVariants;
}

function addTileOffset(pos: Coord): Coord {
  return [
    pos[0],
    pos[1] + tileOffset,
  ];
}

const EDGE_LINE_SUBDIVISIONS = 5;
const EDGE_LINE_RANGE = 0.60;
const EDGE_RIVER_RANGE = 0.35;
const EDGE_RIVER_SUBDIVISIONS = 5;
const CORNER_LINE_SUBDIVISIONS = 1;
const CORNER_LINE_RANGE = 0.50;
const ROAD_COLOR: ColorArray = [128, 83, 11];

function getControlPoints(p1: Coord, p2: Coord) {
  const center = midpoint(p1, p2);
  const c1 = rotatePoint(
    center,
    p2,
    90,
  );
  const c2 = rotatePoint(
    center,
    p2,
    -90,
  );
  return [c1, c2];
}

function buildTile(tileVariant: HexTileSectionVariant, gen: TileGen) {
  const { id, seed, tile } = tileVariant;
  const tileControlPoints = controlPoints[tile.type];
  const bgColor = terrainTypePrimaryColors.get(tile.terrainType);
  const transitionBorders: [TerrainType, TerrainType][] = [];
  const textureTerrainTypes: TerrainType[] = [tile.terrainType];

  // paint BG
  gen.forEachCell(pos => {
    if (gen.isValidCell(pos)) {
      gen.setCellColor(pos, bgColor);
    } else {
      // gen.setCellColor(pos, [0, 0, 0]);
    }
  });

  if (tile.type === TileSectionType.CENTER) {
    // draw center tiles

    // roads
    if (tile.edgeRoads) {
      const roadPoints: CoordArray = [
        addTileOffset(tileControlPoints[SectionControlPoint.HEX_CENTER])
      ];
      for (const sectionEdge of centerTypeEdges) {
        if (!tile.edgeRoads[sectionEdge]) continue;
        roadPoints.push(addTileOffset(tileControlPoints[edgeToCenterControlPoint[sectionEdge]]));
      }
      const roadCenter = randomizePoint(midpointPoints(roadPoints), 5);

      for (const sectionEdge of centerTypeEdges) {
        if (!tile.edgeRoads[sectionEdge]) continue;
        const p1 = roadCenter;
        const p2 = addTileOffset(tileControlPoints[edgeToCenterControlPoint[sectionEdge]]);
        const center = midpoint(p1, p2);
        const c1 = rotatePoint(
          center,
          p1,
          90,
        );
        const c2 = rotatePoint(
          center,
          p1,
          -90,
        );
        gen.query().noisyLine(p1, p2, c1, c2, 3, 0.30)
          .expand(cell => gen.isCellColor(cell, bgColor))
          .paint(ROAD_COLOR)
      }
    }
  } else {
    // draw edge tiles

    // draw edge line
    const edgeTerrainType = tile.edgeTerrainTypes[TileSectionEdge.EDGE];
    const adj1TerrainType = tile.edgeTerrainTypes[TileSectionEdge.ADJ1];
    const adj2TerrainType = tile.edgeTerrainTypes[TileSectionEdge.ADJ2];
    const edgeColor = terrainTypePrimaryColors.get(edgeTerrainType);

    let lineQuery = gen.query();
    if (edgeTerrainType !== tile.terrainType) {
      textureTerrainTypes.push(edgeTerrainType);
      transitionBorders.push([tile.terrainType, edgeTerrainType]);
      transitionBorders.push([edgeTerrainType, tile.terrainType]);
      const c1 = addTileOffset(tileControlPoints[SectionControlPoint.EDGE_CENTER]);
      if (
        adj1TerrainType === TerrainType.RIVER_MOUTH ||
        adj2TerrainType === TerrainType.RIVER_MOUTH
      ) {
        textureTerrainTypes.push(TerrainType.RIVER_MOUTH);
        transitionBorders.push([edgeTerrainType, TerrainType.RIVER_MOUTH]);
        transitionBorders.push([TerrainType.RIVER_MOUTH, edgeTerrainType]);
        lineQuery = gen.query();
        let cp1: SectionControlPoint;
        let cp2: SectionControlPoint;
        let cp3: SectionControlPoint;
        let riverMouthControlPoint: SectionControlPoint;
        let riverMouthFillPoint: SectionControlPoint;
        if (adj1TerrainType === TerrainType.RIVER_MOUTH) {
          cp1 = SectionControlPoint.EDGE_ADJ1;
          cp2 = SectionControlPoint.ADJ1_INSIDE;
          cp3 = adj2TerrainType === edgeTerrainType ? SectionControlPoint.ADJ2_MED : SectionControlPoint.ADJ2_LOW;
          riverMouthControlPoint = SectionControlPoint.ADJ1_MED;
          riverMouthFillPoint = SectionControlPoint.CORNER_ADJ1;
        } else if (adj2TerrainType === TerrainType.RIVER_MOUTH) {
          cp1 = SectionControlPoint.EDGE_ADJ2;
          cp2 = SectionControlPoint.ADJ2_INSIDE;
          cp3 = adj1TerrainType === edgeTerrainType ? SectionControlPoint.ADJ1_MED : SectionControlPoint.ADJ1_LOW;
          riverMouthControlPoint = SectionControlPoint.ADJ2_MED;
          riverMouthFillPoint = SectionControlPoint.CORNER_ADJ2;
        }
        const p1 = addTileOffset(tileControlPoints[cp1]);
        const p2 = addTileOffset(tileControlPoints[cp2]);
        const p3 = addTileOffset(tileControlPoints[cp3])
        const riverMouthPoint = addTileOffset(tileControlPoints[riverMouthControlPoint])
        const cp1_2_center = midpoint(p1, p2);
        const c1 = rotatePoint(
          cp1_2_center,
          p2,
          90,
        );
        const c2 = rotatePoint(
          cp1_2_center,
          p2,
          -90,
        );
        const riverMouthLine = gen.query().noisyLine(p1, p2, c1, c2, 3, 0.40)
        lineQuery
          .merge(riverMouthLine)
          .noisyLine(
            p2,
            p3,
            addTileOffset(tileControlPoints[SectionControlPoint.EDGE_CENTER]),
            addTileOffset(tileControlPoints[SectionControlPoint.INSIDE_CENTER]),
            EDGE_LINE_SUBDIVISIONS,
            EDGE_LINE_RANGE,
          ).paint(edgeColor);
        const riverMouthColor = terrainTypePrimaryColors.get(TerrainType.RIVER_MOUTH);
        const riverMouthLineQuery = gen.query()
          .merge(riverMouthLine)
          .line(
            p2,
            riverMouthPoint
          ).paint(riverMouthColor);
        lineQuery.merge(riverMouthLineQuery);
        gen.floodfill(
          addTileOffset(tileControlPoints[riverMouthFillPoint]),
          riverMouthColor,
          cell => !riverMouthLineQuery.has(cell) && gen.isCellColor(cell, bgColor)
        ).paint(riverMouthColor);
      } else {
        if (edgeTerrainType === TerrainType.RIVER) {
          let cp1 = adj1TerrainType === edgeTerrainType
            ? SectionControlPoint.ADJ1_MED
            : SectionControlPoint.ADJ1_LOW;
          let cp2 = adj2TerrainType === edgeTerrainType
            ? SectionControlPoint.ADJ2_MED
            : SectionControlPoint.ADJ2_LOW;
          const p1 = addTileOffset(tileControlPoints[cp1]);
          const p2 = addTileOffset(tileControlPoints[cp2]);
          const center = getPositionAlongTheLine(
            addTileOffset(tileControlPoints[SectionControlPoint.EDGE_CENTER]),
            addTileOffset(tileControlPoints[SectionControlPoint.INSIDE_CENTER]),
            0.45,
          );
          const line1cp = getControlPoints(p1, center);
          const line2cp = getControlPoints(center, p2);
          lineQuery
            .noisyLine(p1, center, line1cp[0], line1cp[1], EDGE_RIVER_SUBDIVISIONS, EDGE_RIVER_RANGE)
            .noisyLine(center, p2, line2cp[0], line2cp[1], EDGE_RIVER_SUBDIVISIONS, EDGE_RIVER_RANGE)
            .paint(edgeColor);
        } else {
          let cp1 = (adj1TerrainType === edgeTerrainType)
            ? SectionControlPoint.ADJ1_MED
            : SectionControlPoint.ADJ1_LOW;
          let cp2 = (adj2TerrainType === edgeTerrainType)
            ? SectionControlPoint.ADJ2_MED
            : SectionControlPoint.ADJ2_LOW;
          const p1 = addTileOffset(tileControlPoints[cp1]);
          const p2 = addTileOffset(tileControlPoints[cp2]);
          const c1 = addTileOffset(tileControlPoints[SectionControlPoint.EDGE_CENTER]);
          let c2 = addTileOffset(tileControlPoints[SectionControlPoint.INSIDE_CENTER]);
          lineQuery.noisyLine(p1, p2, c1, c2, EDGE_LINE_SUBDIVISIONS, EDGE_LINE_RANGE).paint(edgeColor);
        }
      }
      gen.floodfill(c1, edgeColor, cell => !lineQuery.has(cell) && gen.isCellColor(cell, bgColor)).paint(edgeColor);
    }

    const terrainTransitions = getTerrainTransitions(tile.terrainType);
    const edgeTerrainTransitions = getTerrainTransitions(edgeTerrainType);
    // draw adj1 side line
    if (
      // if adjacent terrain is different than the edge terrain
      adj1TerrainType !== edgeTerrainType
      // if adjacent terrain is not a river mouth
      && adj1TerrainType !== TerrainType.RIVER_MOUTH
      && edgeTerrainType !== tile.terrainType && !isRiverTerrain(adj1TerrainType)
        ? terrainTransitions.has(adj1TerrainType) && edgeTerrainTransitions.has(adj1TerrainType)
        : true
    ) {
      textureTerrainTypes.push(adj1TerrainType);
      transitionBorders.push([tile.terrainType, adj1TerrainType]);
      transitionBorders.push([adj1TerrainType, tile.terrainType]);
      transitionBorders.push([edgeTerrainType, adj1TerrainType]);
      transitionBorders.push([adj1TerrainType, edgeTerrainType]);
      const color = terrainTypePrimaryColors.get(adj1TerrainType);
      const p1 = addTileOffset(tileControlPoints[SectionControlPoint.ADJ1_LOW]);
      const p2 = addTileOffset(tileControlPoints[SectionControlPoint.EDGE_ADJ1]);
      const center = midpoint(p1, p2);
      const c1 = rotatePoint(p1, center, 90);
      const c2 = rotatePoint(p1, center, -90);
      const corner = addTileOffset(tileControlPoints[SectionControlPoint.CORNER_ADJ1]);
      gen.query().noisyLine(p1, p2, c1, c2, CORNER_LINE_SUBDIVISIONS, CORNER_LINE_RANGE).paint(color);
      gen.floodfill(corner, color, cell => gen.isCellColor(cell, edgeColor), false).paint(color);
    }

    // draw adj2 side line
    if (
      adj2TerrainType !== edgeTerrainType
      && adj2TerrainType !== TerrainType.RIVER_MOUTH
      && edgeTerrainType !== tile.terrainType && !isRiverTerrain(adj2TerrainType)
        ? terrainTransitions.has(adj2TerrainType) && edgeTerrainTransitions.has(adj2TerrainType)
        : true
    ) {
      textureTerrainTypes.push(adj2TerrainType);
      transitionBorders.push([tile.terrainType, adj2TerrainType]);
      transitionBorders.push([adj2TerrainType, tile.terrainType]);
      transitionBorders.push([edgeTerrainType, adj2TerrainType]);
      transitionBorders.push([adj2TerrainType, edgeTerrainType]);
      const color = terrainTypePrimaryColors.get(adj2TerrainType);
      const p1 = addTileOffset(tileControlPoints[SectionControlPoint.ADJ2_LOW]);
      const p2 = addTileOffset(tileControlPoints[SectionControlPoint.EDGE_ADJ2]);
      const center = midpoint(p1, p2);
      const c1 = rotatePoint(p1, center, 90);
      const c2 = rotatePoint(p1, center, -90);
      const corner = addTileOffset(tileControlPoints[SectionControlPoint.CORNER_ADJ2]);
      gen.query().noisyLine(p1, p2, c1, c2, CORNER_LINE_SUBDIVISIONS, CORNER_LINE_RANGE).paint(color);
      gen.floodfill(corner, color, cell => gen.isCellColor(cell, edgeColor), false).paint(color);
    }

    // paint transition borders
    let ops: [Coord, ColorArray][] = [];
    for (const [t1, t2] of transitionBorders) {
      const targetColor = terrainTypePrimaryColors.get(t1);
      const neighborColor = terrainTypePrimaryColors.get(t2);
      if (
        targetColor && neighborColor &&
        tileColorTransition.has(t1) && tileColorTransition.get(t1).has(t2)
      ) {
        const { borderColor, accentColor } = tileColorTransition.get(t1).get(t2);
        gen.forEachCell(cell => {
          if (gen.isValidCell(cell) && gen.isCellColor(cell, targetColor)) {
            if (gen.someNeighbor(cell, cell => gen.isCellColor(cell, neighborColor))) {
              ops.push([cell, borderColor]);
            } else if (accentColor && gen.someDiagonal(cell, cell => gen.isCellColor(cell, neighborColor))) {
              ops.push([cell, accentColor]);
            }
          }
        });
      }
    }
    for (const [cell, color] of ops) {
      gen.setCellColor(cell, color);
    }

    // improved borders
    if (
      edgeTerrainType === TerrainType.RIVER
      || adj1TerrainType === TerrainType.RIVER || adj1TerrainType === TerrainType.RIVER_SOURCE
      || adj2TerrainType === TerrainType.RIVER || adj2TerrainType === TerrainType.RIVER_SOURCE
    ) {
      const riverColor = terrainTypePrimaryColors.get(TerrainType.RIVER);
      // const riverBank = gen.getMatchingCells(bgColor)
      //   .filter(cell => gen.someNeighbor(cell, n => gen.isCellColor(n, riverColor)));
      // riverBank.expand(cell => gen.isCellColor(cell, bgColor)).paint([0, 0, 0]);

      const riverEdge = gen.getMatchingCells(riverColor)
        .filter(cell => gen.someNeighbor(cell, n => !gen.isCellColor(n, riverColor) && gen.isValidCell(n)));
      const isEdgeColor = cell => gen.isCellColor(cell, riverColor);
      const band1 = riverEdge
        .expand(isEdgeColor)
        .paint([18, 132, 227]);
      gen.query().expand(isEdgeColor, band1).expand(isEdgeColor).paint([17, 125, 212]);
    }

    // draw roads
    if (tile.edgeRoads && tile.edgeRoads[TileSectionEdge.CENTER] && tile.edgeRoads[TileSectionEdge.EDGE]) {
      const p1 = addTileOffset(tileControlPoints[edgeToCenterControlPoint[TileSectionEdge.EDGE]]);
      const p2 = addTileOffset(tileControlPoints[edgeToCenterControlPoint[TileSectionEdge.CENTER]]);
      const center = midpoint(p1, p2);
      const c1 = rotatePoint(
        center,
        p1,
        90,
      );
      const c2 = rotatePoint(
        center,
        p1,
        -90,
      );
      gen.query().noisyLine(p1, p2, c1, c2, 3, 0.30)
        .paint(ROAD_COLOR)
        .expand(cell => !gen.isCellColor(cell, ROAD_COLOR))
        .paint(ROAD_COLOR)
    }
  }

  // apply textures
  for (const terrainType of textureTerrainTypes) {
    if (terrainPatterns[terrainType]) {
      const patternRng = Alea(Math.random());
      const query = gen.getMatchingCells(terrainTypePrimaryColors.get(terrainType));
      terrainPatterns[terrainType](query, gen.size, patternRng);
    }
  }
}

const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

async function buildTiles(imageSize: Size, tileVariants: HexTileSectionVariant[]) {
  const tilesetImage = await newImage(imageSize.width, imageSize.height);
  progress.start(tileVariants.length, 0);
  tileVariants.forEach((tileVariant, index) => {
    const [x, y] = getTileCoords(index, columns, tileWidth, tileHeight + tileOffset, tilePadding);
    const template = sectionTemplates[tileVariant.tile.type];
    const gen = new TileGen(
      tileSize,
      (pos: Coord) => {
        if (pos[0] < 0 || pos[1] < 0 || pos[0] >= tileSize.width || pos[1] >= tileSize.height) {
          return false;
        }
        const x = pos[0];
        const y = pos[1] - tileOffset;
        if (y >= 0) {
          return template.getPixelColor(x, y) !== 0x00000000;
        }
        return false;
      }
    );
    buildTile(tileVariant, gen);
    progress.update(index);
    gen.addToImage(tilesetImage, [x, y]);
  });
  progress.stop();
  process.stdout.moveCursor(0, -1)
  process.stdout.clearLine(1)
  return tilesetImage;
}

async function saveTilesetDefinition(
  path: string,
  rows: number,
  imageSize: Size,
  tileVariants: HexTileSectionVariant[]
) {
  const def: TilesetDefinition = {
    imageSize,
    tileSize: { width: tileWidth, height: tileHeight + tileOffset },
    tileOffset,
    tilePadding,
    rows,
    columns,
    tiles: tileVariants.map((variant, index) => ({ index, variant })),
  };
  fs.writeFileSync(path, JSON.stringify(def, null, 2));
}

async function main() {
  const templatePath = path.resolve(assetFolder, 'hex-template-sections.png');
  const definitionPath = path.resolve(assetFolder, 'tileset.json');
  const tilesetPath = path.resolve(assetFolder, 'tileset.png');
  const template = await Jimp.read(templatePath);
  for (const section of tileSectionTypeIndexOrder) {
    const [x, y] = getTileCoords(sectionTemplateIndex[section], 8, templateTileWidth, templateTileHeight, 0);
    sectionTemplates[section] = template.clone().crop(x, y, templateTileWidth, templateTileHeight);
  }
  
  // setup tiles
  const tileVariants = createTileDefs();
  console.log(`Creating tileset with ${tileVariants.length} tiles`);

  const rows = Math.ceil(tileVariants.length / columns);
  const width = columns * (tileWidth + tilePadding);
  const height = rows * (tileHeight + tileOffset + tilePadding);
  const imageSize = { width, height };

  // build tileset
  const startTime = performance.now();
  const tilesetImage = await buildTiles(imageSize, tileVariants);
  const endTime = performance.now();
  console.log(`Builing tileset (took ${endTime - startTime}ms)`);
  
  // save image
  console.log(`Saving tileset to ${tilesetPath}`);
  await tilesetImage.writeAsync(tilesetPath);

  // save tileset file
  await saveTilesetDefinition(
    definitionPath,
    rows,
    imageSize,
    tileVariants,
  );
}

main().catch(err => {
  console.log('');
  console.error(err);
  process.exit(1);
});
