import { CompositeRectTileLayer } from 'pixi-tilemap';
import * as PIXI from 'pixi.js';
import { Direction, DirectionMap, CornerMap, directionShort, adjacentDirections, directionCorners, directionIndexOrder, Corner, cornerIndexOrder, cornerDirections, Assets } from './types';
import { colorToNumber } from './utils';
import { EdgeFeature, HexFeature, TerrainType, World, terrainColors, CornerFeature, terrainTransitions } from './World';
import { WorldTileset } from './WorldTileset';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;

  chunkTileLayers: Map<string, CompositeRectTileLayer[]>;
  hexChunk: Map<string, string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  worldTileset: WorldTileset;
  chunksLayer: PIXI.Container;

  constructor(private app: PIXI.Application, world: World, assets: Assets) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.hexgrid.pointWidth();
    this.worldHeight = this.world.hexgrid.pointHeight();
    this.chunksLayer = new PIXI.Container();
    this.worldTileset = new WorldTileset(this.app.renderer, assets);
    console.log(this.worldTileset);
    
    this.chunkTileLayers = new Map();
    this.hexChunk = new Map();
    this.chunkHexes = new Map();
    const { width, height } = world.gridSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
      }

      for (let x = 1; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
      }
    }

    this.render();

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'g') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      }
    });
  }

  private getChunkForCoordinate(x: number, y: number) {
    const y2 = x % 2 + y * 2;
    const chunkY = y2 / CHUNK_HEIGHT | 0;
    const chunkX = (x + (y2 % CHUNK_HEIGHT)) / CHUNK_WIDTH | 0;
    return { chunkX, chunkY };
  }

  private drawChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    const hexes = this.chunkHexes.get(chunkKey);
    const hexPosititions: [number, number][] = [];
    let minX = Infinity;
    let minY = Infinity;
    for (const hex of hexes) {
      const [ x, y ] = this.world.getHexPosition(hex.x, hex.y);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      hexPosititions.push([x, y]);
    }
    // TODO: why casting is required
    (terrainLayer as any).position.set((minX), (minY));

    hexes.forEach((hex, index) => {
      const terrainType = this.world.getTerrainForCoord(hex.x, hex.y);
      if (terrainType === TerrainType.MAP_EDGE) return;
      const hexObj = this.world.getHex(hex.x, hex.y);
      const cornerTerrainTypes: Partial<CornerMap<TerrainType>> = {};

      const edgeTerrainTypes = this.world.getHexNeighborTerrain(hex.x, hex.y);
      for (let direction of directionIndexOrder) {
        const edgeTerrainType = edgeTerrainTypes[direction];
        if (!(
          terrainTransitions[terrainType] && 
          terrainTransitions[terrainType].includes(edgeTerrainType)
        )) {
          edgeTerrainTypes[direction] = terrainType;
        }
      }
      if (this.world.hexRiverEdges.containsKey(hexObj)) {
        const riverDirections = this.world.hexRiverEdges.getValue(hexObj);
        for (let dir of riverDirections) {
          edgeTerrainTypes[dir] = TerrainType.RIVER;
        }
      }

      // if any of this hex's neighbors have a river between them,
      // set this corner feature to river
      for (let corner of cornerIndexOrder) {
        const directions = cornerDirections[corner];
        const neighborOne = this.world.getHexNeighbor(hex.x, hex.y, directions[0]);
        const neighborTwo = this.world.getHexNeighbor(hex.x, hex.y, directions[1]);
        if (
          // river on corners
          // if this hex has rivers with either of the neighbors
          (this.world.riverHexPairs.has(hexObj) && 
          this.world.riverHexPairs.get(hexObj).has(neighborTwo))
          ||
          (this.world.riverHexPairs.has(hexObj) && 
          this.world.riverHexPairs.get(hexObj).has(neighborOne))
        ) {
          cornerTerrainTypes[corner] = TerrainType.RIVER;
        } else if (
          // river mouth / end
          this.world.riverHexPairs.has(neighborOne) && this.world.riverHexPairs.get(neighborOne).has(neighborTwo)
        ) {
          // cornerTerrainTypes[corner] = TerrainType.RIVER_MOUTH;
          cornerTerrainTypes[corner] = terrainType === TerrainType.OCEAN
            ? TerrainType.RIVER_MOUTH
            : TerrainType.RIVER_SOURCE;
        } else {
          let cornerTerrainType: TerrainType = TerrainType.MAP_EDGE;
          if (neighborOne && neighborTwo) {
            const neighborOneTerrain = this.world.getTerrainForCoord(neighborOne.x, neighborOne.y);
            const neighborTwoTerrain = this.world.getTerrainForCoord(neighborTwo.x, neighborTwo.y);
            let transitionTerrainType: TerrainType;
            if (terrainTransitions[neighborOneTerrain] && terrainTransitions[neighborOneTerrain].includes(neighborTwoTerrain)) {
              transitionTerrainType = neighborTwoTerrain;
            } else if (terrainTransitions[neighborTwoTerrain] && terrainTransitions[neighborTwoTerrain].includes(neighborOneTerrain)) {
              transitionTerrainType = neighborOneTerrain;
            } else if (neighborOneTerrain === neighborTwoTerrain) {
              transitionTerrainType = neighborOneTerrain;
            }
            if (terrainTransitions[terrainType] && terrainTransitions[terrainType].includes(transitionTerrainType)) {
              cornerTerrainType = transitionTerrainType;
            } else {
              cornerTerrainType = terrainType;
            }
          } else {
            cornerTerrainType = terrainType;
          }
          cornerTerrainTypes[corner] = cornerTerrainType;
        }
      }

      const hexTileID = this.worldTileset.getTile({
        terrainType,
        edgeTerrainTypes,
        cornerTerrainTypes: cornerTerrainTypes as CornerMap<TerrainType>,
        hexFeature: HexFeature.NONE,
      });
      const texture = this.worldTileset.getTextureForID(hexTileID);
      const [ x, y ] = hexPosititions[index];
      if (texture) {
        terrainLayer.addFrame(
          texture,
          (x - minX),
          (y - minY),
        );
      }
    });
  }

  render() {
    console.time('drawHexTile');
    
    this.worldTileset.updateTileset();
    console.timeEnd('drawHexTile');

    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    const bitmaps = [
      new PIXI.Texture(this.worldTileset.renderTexture.baseTexture),
    ];
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new CompositeRectTileLayer(0, bitmaps);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      this.drawChunk(chunkKey);
    }
    this.worldTileset.updateTileset();
    console.timeEnd('draw chunks');
    console.groupEnd();

    // const sprite = new PIXI.Sprite(this.worldTileset.renderTexture);
    // this.debugGraphics.addChild(sprite);


    // debug
    this.world.hexgrid.forEach(hex => {
      const point = hex.toPoint()
      const corners = hex.round().corners().map(corner => corner.add(point));
      const center = {
        x: hex.center().x + point.x,
        y: hex.center().y + point.y,
      };
      const [firstCorner, ...otherCorners] = corners

      // draw grid lines
      this.debugGraphics.lineStyle(1, 0xFFFFFF);
      this.debugGraphics.moveTo(firstCorner.x, firstCorner.y)
      otherCorners.forEach(({ x, y }) => this.debugGraphics.lineTo(x, y))
      this.debugGraphics.lineTo(firstCorner.x, firstCorner.y)

      // draw terrain type indicator
      const color = terrainColors[this.world.terrain.get(hex.x, hex.y)];
      if (color) {
        this.debugGraphics.beginFill(color);
        this.debugGraphics.drawCircle(center.x, center.y, 5);
        this.debugGraphics.endFill();
      }

      if (this.world.hexRiverEdges.containsKey(hex)) {
        this.debugGraphics.lineStyle(5, 0x0000FF);
        for (const [p1, p2] of this.world.hexRiverPoints.getValue(hex)) {
          this.debugGraphics.moveTo(p1.x, p1.y);
          this.debugGraphics.lineTo(p2.x, p2.y);
        }
      }
    });
  }
}