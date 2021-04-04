import { ArrayViewMixin, MapViewMixin, ObjectViewMixin } from "structurae";
import { Direction } from '../types';


export type WorldMapStateHex = {
  index: number,
  terrainType: number,
  distanceToCoast: number,
  rainfall: number,
  population: number,
  pressureJanuary: number,
  pressureJuly: number,
  windDirectionJanuary: number,
  windSpeedJanuary: number,
  windDirectionJuly: number,
  windSpeedJuly: number,
  height: number,
  coordX: number,
  coordY: number,
  posX: number,
  posY: number,
  regionID?: string,
  river: Record<Direction, number>;
  road: Record<Direction, number>;
};

export const WorldMapState = MapViewMixin({
  $id: 'WorldMapState',
  type: 'object',
  properties: {
    hexWidth: { type: 'integer', btype: 'uint32' },
    hexHeight: { type: 'integer', btype: 'uint32' },
    pointWidth: { type: 'integer', btype: 'uint32' },
    pointHeight: { type: 'integer', btype: 'uint32' },
    sealevel: { type: 'integer', btype: 'uint32' },
    hexes: {
      type: 'array',
      items: {
        $id: 'Hex',
        type: 'object',
        properties: {
          index: { type: 'integer', btype: 'uint32' },
          terrainType: { type: 'integer', btype: 'uint32' },
          rainfall: { type: 'integer', btype: 'uint32' },
          distanceToCoast: { type: 'integer', btype: 'uint32' },
          pressureJanuary: { type: 'number', btype: 'float32' },
          pressureJuly: { type: 'number', btype: 'float32' },
          windDirectionJanuary: { type: 'number', btype: 'uint8' },
          windSpeedJanuary: { type: 'number', btype: 'float32' },
          windDirectionJuly: { type: 'number', btype: 'uint8' },
          windSpeedJuly: { type: 'number', btype: 'float32' },
          population: { type: 'integer', btype: 'uint32' },
          height: { type: 'integer', btype: 'uint32' },
          coordX: { type: 'integer', btype: 'uint32' },
          coordY: { type: 'integer', btype: 'uint32' },
          posX: { type: 'integer', btype: 'uint32' },
          posY: { type: 'integer', btype: 'uint32' },
          regionID: { type: 'string', default: '', maxLength: 36 },
          river: {
            $id: 'HexRiver',
            type: 'object',
            properties: {
              [Direction.SE]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.NE]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.N]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.NW]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.SW]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.S]: { type: 'integer', btype: 'uint8', default: 0 },
            },
          },
          road: {
            $id: 'HexRoad',
            type: 'object',
            properties: {
              [Direction.SE]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.NE]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.N]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.NW]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.SW]: { type: 'integer', btype: 'uint8', default: 0 },
              [Direction.S]: { type: 'integer', btype: 'uint8', default: 0 },
            },
          }
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