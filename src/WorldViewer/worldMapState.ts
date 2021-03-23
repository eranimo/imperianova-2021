import { ArrayViewMixin, MapViewMixin, ObjectViewMixin } from "structurae";
import { Direction } from '../types';


export type WorldMapStateHex = {
  index: number,
  terrainType: number,
  coordX: number,
  coordY: number,
  posX: number,
  posY: number,
  regionID: number,
};

export const WorldMapState = MapViewMixin({
  $id: 'WorldMapState',
  type: 'object',
  properties: {
    hexWidth: { type: 'integer', btype: 'uint32' },
    hexHeight: { type: 'integer', btype: 'uint32' },
    pointWidth: { type: 'integer', btype: 'uint32' },
    pointHeight: { type: 'integer', btype: 'uint32' },
    hexes: {
      type: 'array',
      items: {
        $id: 'Hex',
        type: 'object',
        properties: {
          index: { type: 'integer', btype: 'uint32' },
          terrainType: { type: 'integer', btype: 'uint32' },
          coordX: { type: 'integer', btype: 'uint8' },
          coordY: { type: 'integer', btype: 'uint8' },
          posX: { type: 'integer', btype: 'uint32' },
          posY: { type: 'integer', btype: 'uint32' },
          regionID: { type: 'string', default: '', maxLength: 36 },
          // river: {
          //   [Direction.SE]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.NE]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.N]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.NW]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.SW]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.S]: { type: 'integer', btype: 'uint8', default: 0 },
          // },
          // road: {
          //   [Direction.SE]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.NE]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.N]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.NW]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.SW]: { type: 'integer', btype: 'uint8', default: 0 },
          //   [Direction.S]: { type: 'integer', btype: 'uint8', default: 0 },
          // }
        }
      }
    },
    // regions: {
    //   type: 'array',
    //   items: {
    //     $id: 'Region',
    //     type: 'object',
    //     properties: {
    //       id: { type: 'string', maxLength: 36 },
    //       label: { type: 'string', maxLength: 50 },
    //       color: { type: 'number', btype: 'uint32', maxLength: 50 },
    //     }
    //   }
    // }
  }
});