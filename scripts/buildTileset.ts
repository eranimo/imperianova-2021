#!/usr/bin/env ts-node

import Jimp from "jimp";
import { CornerMap, DirectionMap, directionIndexOrder, Direction, directionCorners, Corner, cornerDirections } from '../src/types';
import path from 'path';
import { HexTile, TerrainType, terrainTransitions, terrainTypeIndexOrder, terrainTypeTitles } from '../src/shared';


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

const assetFolder = path.resolve(__dirname, '..', 'src', 'assets');

const getTransitions = (terrainType: TerrainType) => ([
  terrainType,
  terrainType !== TerrainType.COAST && terrainType !== TerrainType.OCEAN && TerrainType.RIVER,
  ...(terrainTransitions[terrainType] || [])
].filter(i => i));

// if terrainType1 is on the "bottom" in a transition with terrainType2
// e.g. COAST has a transition on GRASSLANDD
const hasTransition = (terrainType1: TerrainType, terrainType2: TerrainType) => (
  terrainTransitions[terrainType1] && terrainTransitions[terrainType1].includes(terrainType2)
);


function createTiles() {
  const tiles: HexTile[] = [];

  for (const terrainType of baseTerrainTypes) {
    const edgeTerrainTypes = getTransitions(terrainType);
    console.log(`Terrain: ${terrainTypeTitles[terrainType].padEnd(20)}Edges:`, edgeTerrainTypes.map(t => terrainTypeTitles[t]).join(', '));
    let count = 0;
    for (const edge_terrain_se of edgeTerrainTypes) {
      for (const edge_terrain_ne of edgeTerrainTypes) {
        for (const edge_terrain_n of edgeTerrainTypes) {
          for (const edge_terrain_nw of edgeTerrainTypes) {
            for (const edge_terrain_sw of edgeTerrainTypes) {
              for (const edge_terrain_s of edgeTerrainTypes) {
                count++;
                let corner_terrain_right: TerrainType;
                // NE SE
                if (hasTransition(edge_terrain_ne, edge_terrain_se)) {
                  corner_terrain_right = edge_terrain_se;
                } else if (hasTransition(edge_terrain_se, edge_terrain_ne)) {
                  corner_terrain_right = edge_terrain_ne;
                } else {
                  corner_terrain_right = terrainType;
                }

                // SE S
                let corner_terrain_bottom_right: TerrainType;
                if (hasTransition(edge_terrain_se, edge_terrain_s)) {
                  corner_terrain_right = edge_terrain_s;
                } else if (hasTransition(edge_terrain_s, edge_terrain_se)) {
                  corner_terrain_right = edge_terrain_se;
                } else {
                  corner_terrain_right = terrainType;
                }

                // S SW
                let corner_terrain_bottom_left: TerrainType;
                if (hasTransition(edge_terrain_s, edge_terrain_sw)) {
                  corner_terrain_right = edge_terrain_sw;
                } else if (hasTransition(edge_terrain_sw, edge_terrain_s)) {
                  corner_terrain_right = edge_terrain_s;
                } else {
                  corner_terrain_right = terrainType;
                }

                // SW NW
                let corner_terrain_left: TerrainType;
                if (hasTransition(edge_terrain_sw, edge_terrain_nw)) {
                  corner_terrain_right = edge_terrain_nw;
                } else if (hasTransition(edge_terrain_nw, edge_terrain_sw)) {
                  corner_terrain_right = edge_terrain_sw;
                } else {
                  corner_terrain_right = terrainType;
                }

                // NW N
                let corner_terrain_top_left: TerrainType;
                if (hasTransition(edge_terrain_nw, edge_terrain_n)) {
                  corner_terrain_right = edge_terrain_n;
                } else if (hasTransition(edge_terrain_n, edge_terrain_nw)) {
                  corner_terrain_right = edge_terrain_nw;
                } else {
                  corner_terrain_right = terrainType;
                }

                // N NE
                let corner_terrain_top_right: TerrainType;
                if (hasTransition(edge_terrain_n, edge_terrain_ne)) {
                  corner_terrain_right = edge_terrain_ne;
                } else if (hasTransition(edge_terrain_ne, edge_terrain_n)) {
                  corner_terrain_right = edge_terrain_n;
                } else {
                  corner_terrain_right = terrainType;
                }

                tiles.push({
                  terrainType,
                  edgeTerrainTypes: {
                    [Direction.SE]: edge_terrain_se,
                    [Direction.NE]: edge_terrain_ne,
                    [Direction.N]: edge_terrain_n,
                    [Direction.NW]: edge_terrain_nw,
                    [Direction.SW]: edge_terrain_sw,
                    [Direction.S]: edge_terrain_s,
                  },
                  cornerTerrainTypes: {
                    [Corner.RIGHT]: corner_terrain_right,
                    [Corner.BOTTOM_RIGHT]: corner_terrain_bottom_right,
                    [Corner.BOTTOM_LEFT]: corner_terrain_bottom_left,
                    [Corner.LEFT]: corner_terrain_left,
                    [Corner.TOP_LEFT]: corner_terrain_top_left,
                    [Corner.TOP_RIGHT]: corner_terrain_top_right,
                  },
                  edgeRoads: {
                    [Direction.SE]: false,
                    [Direction.NE]: false,
                    [Direction.N]: false,
                    [Direction.NW]: false,
                    [Direction.SW]: false,
                    [Direction.S]: false,
                  },
                })
              }
            }
          }
        }
      }
    }
    console.log(`count: ${count}\n`);
  }

  return tiles;
}

function buildTile() {

}

async function main() {
  const templatePath = path.resolve(assetFolder, 'hex-template.png');
  const template = await Jimp.read(templatePath);
  const tiles = createTiles();

  console.log(`Building tileset with ${tiles.length} tiles`);
}

main().catch(err => {
  console.error(err);
});