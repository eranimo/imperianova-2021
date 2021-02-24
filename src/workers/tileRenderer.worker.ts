import FastPoissonDiskSampling from 'fast-2d-poisson-disk-sampling';
import { clamp } from 'lodash';
import ndarray from 'ndarray';
import { expose, Transfer } from 'threads/worker';
import { CellType, cellTypeColor, cellTypeFeatures, cornerCellTypes, cornerSideCellTypes, directionCellTypes, HexTile, OFFSET_Y, renderOrder, terrainPrimaryCellTypes } from '../hexTile';
import { TileGrid } from '../TileGrid';
import {ExportedTileset, ColorArray, Coord, CoordArray, cornerDirections, cornerIndexOrder, Direction, directionIndexOrder, DirectionMap, Size } from '../types';
import { getImageIndexFromCoord, midpoint, midpointPoints, pickRandom, rotatePoint } from '../utils';
import { terrainTransitions, TerrainType } from '../terrain';


const ENABLE_TRANSITIONS = true;
const ENABLE_FEATURES = true;
const ENABLE_ROADS = true;

const edgeCenterPoints: DirectionMap<Coord> = {
  [Direction.SE]: [56, 44 + OFFSET_Y],
  [Direction.NE]: [56, 15 + OFFSET_Y],
  [Direction.N]: [31, 0 + OFFSET_Y],
  [Direction.NW]: [7, 15 + OFFSET_Y],
  [Direction.SW]: [7, 44 + OFFSET_Y],
  [Direction.S]: [31, 59 + OFFSET_Y],
};


function placeObject(
  autogenLayer: ndarray,
  autogenObjects: ExportedTileset,
  tileID: number,
  pos: Coord,
) {
  if (!autogenObjects.tiles[tileID]) {
    throw new Error(`Unknown autogen object with ID ${tileID}`);
  }
  const { x: tx, y: ty, width, height } = autogenObjects.tiles[tileID];
  for (let y = ty; y < (ty + height); y++) {
    for (let x = tx; x < (tx + width); x++) {
      const index = getImageIndexFromCoord([x, y], autogenObjects.size.width);
      const a = autogenObjects.buffer[index + 3] / 255;
      if (a > 0) {
        const r = autogenObjects.buffer[index] / 255;
        const g = autogenObjects.buffer[index + 1] / 255;
        const b = autogenObjects.buffer[index + 2] / 255;
        const ax = ((x - tx) + pos[0]) - 7;
        const ay = ((y - ty) + pos[1]) - 14;
        autogenLayer.set(ax, ay, 0, r);
        autogenLayer.set(ax, ay, 1, g);
        autogenLayer.set(ax, ay, 2, b);
        autogenLayer.set(ax, ay, 3, a);
      }
    }
  }
}

let poissonPoints;

function drawHexTile(
  tileBuffer: SharedArrayBuffer,
  hexTile: HexTile,
  width: number,
  height: number,
  templateGrid: ndarray,
  autogenObjects: ExportedTileset,
) {
  const grid = new TileGrid(hexTile, width, height);
  const centerPoint: Coord = [32, 32 + OFFSET_Y];

  // replace template grid with correct cell types
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < (height - OFFSET_Y); y++) {
      grid.set(x, y + OFFSET_Y, templateGrid.get(x, y));
    }
  }

  const cellTypeReplacements = new Map<CellType, CellType>();
  for (const direction of directionIndexOrder) {
    const edgeTerrainType = hexTile.edgeTerrainTypes[direction] as TerrainType;
    cellTypeReplacements.set(
      directionCellTypes[direction],
      terrainPrimaryCellTypes[edgeTerrainType]
    );
  }

  for (const corner of cornerIndexOrder) {
    const cornerTerrainType = hexTile.cornerTerrainTypes[corner] as TerrainType;
    cellTypeReplacements.set(
      cornerCellTypes[corner],
      terrainPrimaryCellTypes[cornerTerrainType]
    );

    for (let i = 0; i <= 1; i++) {
      const dir = cornerDirections[corner][i];
      let cornerSideTerrainType = hexTile.edgeTerrainTypes[dir] as TerrainType;
      if (
        // cornerTerrainType === TerrainType.RIVER || 
        cornerTerrainType === TerrainType.RIVER_MOUTH || 
        (terrainTransitions[hexTile.edgeTerrainTypes[dir]] &&
          terrainTransitions[hexTile.edgeTerrainTypes[dir]].includes(cornerTerrainType))
      ) {
        cornerSideTerrainType = cornerTerrainType;
      }
      
      cellTypeReplacements.set(
        cornerSideCellTypes[corner][i],
        terrainPrimaryCellTypes[cornerSideTerrainType],
      );
    }
  }

  // replace debug cell types with real cell types
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cellType = grid.get(x, y);
      if (cellTypeReplacements.has(cellType)) {
        grid.set(x, y, cellTypeReplacements.get(cellType));
      }
    }
  }

  // draw a line from each river mouth cell to the center of the hex
  // to ensure rivers actually flow into the ocean
  if (hexTile.terrainType === TerrainType.COAST) {
    const riverMouthLines: [Coord, Coord][]  = [];
    grid.forEachCell((x, y) => {
      if (grid.get(x, y) === CellType.RIVER_MOUTH) {
        const point: Coord = [x, y];
        riverMouthLines.push([point, centerPoint]);
      }
    });
    for (const [p1, p2] of riverMouthLines) {
      grid.plotLine(p1, p2, CellType.RIVER_MOUTH);
    }
  }

  // terrain transitions
  if (ENABLE_TRANSITIONS) {
    let cellTypePoints = new Map();
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const cellType = grid.get(x, y);
        if (cellType !== CellType.NONE && cellType !== CellType.DEBUG_CENTER) {
          if (cellTypePoints.has(cellType)) {
            cellTypePoints.get(cellType).push([x, y]);
          } else {
            cellTypePoints.set(cellType, [[x, y]]);
          }
        }
      }
    }

    const isRiver = cellType => (
      cellType === CellType.RIVER
      || cellType === CellType.RIVER_MOUTH
      || cellType === CellType.RIVER_SOURCE
    );
    for (let count = 1; count <= 4; count++) {
      for (const cellType of renderOrder) {
        const cells = cellTypePoints.get(cellType);
        if (!cells) continue;
        let newCells: CoordArray;
        if (isRiver(cellType) && count >= 3) {
          continue;
        }
        newCells = grid.expandNaturally(
          cells,
          value => value == CellType.DEBUG_CENTER,
          cellType,
          1,
          isRiver(cellType) ? 0.85 : 0.70,
        );
        if (count === 4) {
          grid.removeIslandNeighbors(
            cells,
            CellType.DEBUG_CENTER,
            cellType,
            cellType,
          );
          grid.removeIslandNeighbors(
            cells,
            cellType,
            CellType.DEBUG_CENTER,
            CellType.DEBUG_CENTER,
          );
        }
        cellTypePoints.set(cellType, newCells);
      }
    }
  }

  // roads
  if (ENABLE_ROADS) {
    let roadCenter = centerPoint;
    let roadPoints: CoordArray = [];
    for (const direction of directionIndexOrder) {
      if (hexTile.edgeRoads[direction]) {
        roadPoints.push(edgeCenterPoints[direction]);
      }
    }
    if (roadPoints.length > 1) {
      roadCenter = midpointPoints(roadPoints);

      const randomizePoint = (point: Coord, range: number): Coord => {
        return [
          point[0] + (Math.round((Math.random() - 0.5) * 5)),
          point[1] + (Math.round((Math.random() - 0.5) * 5)),
        ];
      }
      roadCenter = randomizePoint(roadCenter, 5);
    
      let roadCells = [];
      for (const direction of directionIndexOrder) {
        if (hexTile.edgeRoads[direction]) {
          const [x, y] = edgeCenterPoints[direction];
          const center = randomizePoint(midpoint(roadCenter, [x, y]), 5);
          const c1 = rotatePoint(
            center,
            roadCenter,
            90,
          );
          const c2 = rotatePoint(
            center,
            roadCenter,
            -90,
          );
          const cells = grid.getNoisyLine(
            roadCenter,
            [x, y],
            c1,
            c2,
            CellType.ROAD,
            3,
            0.30
          );
          for (const [cx, cy] of cells) {
            grid.set(cx, cy, CellType.ROAD);
            roadCells.push([cx, cy]);
          }
        }
      }
      grid.expand(
        roadCells,
        value => value !== CellType.NONE,
        CellType.ROAD,
        1,
      )
    }
  }

  const centerCellType = terrainPrimaryCellTypes[hexTile.terrainType];
  grid.replaceAll(CellType.DEBUG_CENTER, centerCellType);

  const autogenLayer = ndarray(new Float32Array(width * height * 4), [width, height, 4]);

  // features
  if (ENABLE_FEATURES) {
    const features = ndarray(new Int8Array(width * height), [width, height]);
    features.data.fill(-1);

    // TODO: generate more than 1 set of poisson disk sampling
    let points;
    if (!poissonPoints) {
      const poissonDisk = new FastPoissonDiskSampling({
        shape: [width, height],
        radius: 3,
        tries: 10,
      }, Math.random);
      poissonDisk.fill();
      points = poissonDisk.getAllPoints() as CoordArray;
      poissonPoints = points;
    } else {
      points = poissonPoints;
    }
    if (points.length > 0) {
      for (const [x, y] of points) {
        const cx = Math.round(x);
        const cy = Math.round(y);
        const cellType = grid.get(cx, cy);
        if (
          cellTypeFeatures[cellType]
        ) {
          const id = pickRandom(cellTypeFeatures[cellType])
          features.set(cx, cy, id);
        }
      }
    }
    
    for (let fy = 0; fy < height; fy++) {
      for (let fx = 0; fx < width; fx++) {
        const featureID = features.get(fx, fy);
        if (featureID >= 0) {
          placeObject(autogenLayer, autogenObjects, featureID, [fx, fy]);
        }
      }
    }
  }

  // convert to image
  const buffer = new Float32Array(tileBuffer);
  let i = 0;
  const dim = 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellType = grid.get(x, y);
      const color = cellTypeColor[cellType];
      if (color) {
        let [r, g, b] = color;
        buffer[(i * dim) + 0] = r / 255;
        buffer[(i * dim) + 1] = g / 255;
        buffer[(i * dim) + 2] = b / 255;
        buffer[(i * dim) + 3] = 1;
      } else {
        buffer[(i * dim) + 0] = 0;
        buffer[(i * dim) + 1] = 0;
        buffer[(i * dim) + 2] = 0;
        buffer[(i * dim) + 3] = 0;
      }
      const r_o = autogenLayer.get(x, y, 0);
      const g_o = autogenLayer.get(x, y, 1);
      const b_o = autogenLayer.get(x, y, 2);
      const a_o = autogenLayer.get(x, y, 3);
      if (a_o !== 0) {
        buffer[(i * dim) + 0] = r_o;
        buffer[(i * dim) + 1] = g_o;
        buffer[(i * dim) + 2] = b_o;
        buffer[(i * dim) + 3] = a_o;
      }
      i++;
    }
  }
}

expose(function renderWorker (
  tileBuffer: SharedArrayBuffer,
  hexTile: HexTile,
  width: number,
  height: number,
  templateGridBuffer: SharedArrayBuffer,
  templateGridSize: Size,
  autogenObjects: ExportedTileset,
) {
  const templateGrid = ndarray(new Uint8ClampedArray(templateGridBuffer), [templateGridSize.width, templateGridSize.height]);
  try {
    drawHexTile(
      tileBuffer,
      hexTile,
      width,
      height,
      templateGrid,
      autogenObjects,
    );
  } catch (err) {
    console.error(err);
  }
  
});
