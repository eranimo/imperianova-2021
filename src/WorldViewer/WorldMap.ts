import { Tilemap } from '@pixi/tilemap';
import cull from 'pixi-cull';
import { Viewport } from 'pixi-viewport';
import { TerrainType } from '../game/world/terrain';
import { Coord, Direction, directionIndexOrder } from '../types';
import { Grid2D } from '../utils/Grid2D';
import {
  Container,
  Graphics,
  ParticleContainer,
  Sprite,
  Text,
  Texture
} from 'pixi.js';
import { WorldMapManager } from './WorldMapManager';
import { Region, WorldMapRegions } from './WorldMapRegions';
import { Assets } from './WorldViewer.worker';
import { logTime } from '../utils';
import { MapMode } from './mapMode';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

const DEBUG_RIVER_COLOR = 0x0000FF;
const DEBUG_ROAD_COLOR = 0x80530b;

class MapIcon extends Container{
  sprite: Sprite;

  constructor(filename: string) {
    super();

    import(
      /* webpackMode: "lazy-once" */
      `../assets/icons/${filename}.svg`
    ).then((src) => {
      Texture.fromURL(src.default).then(texture => {
        const sprite = new Sprite(texture);
        this.sprite = sprite;
        sprite.width = 48;
        sprite.height = 48;
        sprite.tint = 0xC0C0C0;
        sprite.anchor.set(0.5);
        this.addChild(sprite);
      });
    });
  }
}


class MapLabel extends Container {
  labelText: Text;

  constructor(
    label: string,
    fontSize: number,
  ) {
    super();
    this.labelText = new Text(label, {
      // font: '32px Tahoma',
      fill: '#FFF',
      align: 'center',
      stroke: '#111',
      strokeThickness: 3,
    });
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);
  }
}

export class WorldMap {
  public debugGraphics: Graphics;

  chunkTileLayers: Map<string, Tilemap[]>;
  chunkLayerToChunk: Map<Tilemap, string>;
  chunkOffset: Map<string, Coord>;
  chunkDirty: Map<string, boolean>;
  hexChunk: Grid2D<string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  chunkDrawTimes: Map<string, number>;
  chunksLayer: Container;

  overlayLayer: ParticleContainer;
  gridLayer: ParticleContainer;
  regionLayer: ParticleContainer;
  roadsLayer: ParticleContainer;
  riversLayer: ParticleContainer;

  hexOverlaySprites: Map<number, Sprite>;
  hexGridSprites: Map<number, Sprite>;
  hexBorderSprites: Map<number, Map<Direction, Sprite>>;

  cull: cull.Simple;

  labelContainer: Container;
  regionLabels: Map<Region, MapLabel[]>;
  regionMap: WorldMapRegions;

  hexMapIcons: Map<number, string>;
  hexMapIconsSprites: Map<number, MapIcon>;
  iconsLayer: Container;

  constructor(
    public manager: WorldMapManager,
    private assets: Assets
  ) {
    (window as any).worldMap = this;
    this.debugGraphics = new Graphics();
    this.chunksLayer = new Container();

    this.chunkDirty = new Map();
    this.chunkLayerToChunk = new Map();
    this.chunkOffset = new Map();
    
    this.chunkTileLayers = new Map();
    this.chunkDrawTimes = new Map();
    this.regionLabels = new Map();
    const { width, height } = manager.mapSize;
    this.hexChunk = new Grid2D(width, height);
    this.chunkHexes = new Map();
    this.labelContainer = new Container();

    this.hexOverlaySprites = new Map();
    this.hexGridSprites = new Map();
    this.hexBorderSprites = new Map();
    this.overlayLayer = new ParticleContainer(width * height, { tint: true });
    this.gridLayer = new ParticleContainer(width * height, { tint: true });
    this.regionLayer = new ParticleContainer(width * height, { tint: true });
    this.roadsLayer = new ParticleContainer(width * height, { tint: true });
    this.riversLayer = new ParticleContainer(width * height, { tint: true });

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(x, y, chunkKey);
      }

      for (let x = 1; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(x, y, chunkKey);
      }
    }

    this.cull = new cull.Simple();

    this.render();

    const updateMap = () => {
      for (const [hex, overlaySprite] of this.hexOverlaySprites) {
        overlaySprite.tint = manager.mapMode$.value.setTile(hex, manager);
      }
    }

    manager.dirty$.subscribe(updateMap);
    manager.dirtyHex$.subscribe(hexIndex => {
      const overlaySprite = this.hexOverlaySprites.get(hexIndex);
      overlaySprite.tint = manager.mapMode$.value.setTile(hexIndex, manager);
    });

    manager.mapMode$.subscribe(mapMode => {
      this.riversLayer.visible = mapMode.displayRivers;
      updateMap();
    });

    this.cull.addList(this.chunksLayer.children as any, true);
    this.iconsLayer = new Container();
    this.hexMapIcons = new Map();
    this.hexMapIconsSprites = new Map();

    // setup events
    this.chunksLayer.visible = false;
    // document.addEventListener('keyup', event => {
    //   if (event.key === 'd') {
    //     this.debugGraphics.visible = !this.debugGraphics.visible;
    //   } else if (event.key === 'o') {
    //     this.overlayLayer.visible = !this.overlayLayer.visible;
    //     this.chunksLayer.visible = !this.overlayLayer.visible;
    //   } else if (event.key === 'g') {
    //     this.gridLayer.visible = !this.gridLayer.visible;
    //   }
    // });

    // const updateRegionLabel = (region: Region) => {
    //   const labelPositions = region.calculateLabels();
    //   if (this.regionLabels.has(region)) {
    //     const labels = this.regionLabels.get(region);
    //     for (const label of labels) {
    //       this.labelContainer.removeChild(label);
    //     }
    //   }
    //   this.regionLabels.set(region, labelPositions.map(([x, y]) => {
    //     const label = new MapLabel(region.name, 16)
    //     label.position.set(x, y);
    //     this.labelContainer.addChild(label);
    //     return label;
    //   }));
    // }

    // const updateRegionMap = (region: Region) => {
    //   const chunks = new Set<string>();
    //   for (const hex of region.hexes) {
    //     const chunk = this.hexChunk.get(hex.x, hex.y);
    //     chunks.add(chunk);
    //   }
    //   for (const chunk of chunks) {
    //     this.drawChunk(chunk);
    //   }
    // }
  
    // const removeRegionLabel = (region: Region) => {
    //   const labels = this.regionLabels.get(region)
    //   this.regionLabels.delete(region);
    //   for (const label of labels) {
    //     this.labelContainer.removeChild(label);
    //   }
    // }

    // this.regionMap.regions.added$.subscribe(region => {
    //   region.update();
    //   updateRegionLabel(region);
    // });
    // this.regionMap.regionHexAdded$.subscribe(([region]) => {
    //   console.log('region hex added', region);
    //   region.update();
    //   updateRegionLabel(region);
    //   updateRegionMap(region);
    // });
    // this.regionMap.regionHexRemoved$.subscribe(([region, hex]) => {
    //   console.log('region hex removed', region);
    //   region.update();
    //   updateRegionLabel(region);
    //   updateRegionMap(region);
    //   const chunk = this.hexChunk.get(hex.x, hex.y);
    //   this.drawChunk(chunk);
    // });
    // this.regionMap.regions.deleted$.subscribe(region => removeRegionLabel(region));
  }

  setIcon(hex: number, icon: string) {
    this.hexMapIcons.set(hex, icon);
  }

  onViewportMoved(viewport: Viewport) {
    const bounds = viewport.getVisibleBounds()
    bounds.x -= 1000;
    bounds.y -= 1000;
    bounds.width += 1000;
    bounds.height += 1000;
    this.cull.cull(bounds);
    const visibleChunkLayers = this.cull.query(bounds);

    // console.log(this.cull.stats());

    for (const tilemapLayer of visibleChunkLayers) {
      if (tilemapLayer instanceof Tilemap) {
        const chunk = this.chunkLayerToChunk.get(tilemapLayer);
        if (this.chunkDirty.get(chunk)) {
          this.drawChunk(chunk);
        }
      }
    }
  }

  private getChunkForCoordinate(x: number, y: number) {
    const y2 = x % 2 + y * 2;
    const chunkY = y2 / CHUNK_HEIGHT | 0;
    const chunkX = (x + (y2 % CHUNK_HEIGHT)) / CHUNK_WIDTH | 0;
    return { chunkX, chunkY };
  }

  private drawChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    const timeStart = Date.now();
    const hexes = this.chunkHexes.get(chunkKey);
    const [minX, minY] = this.chunkOffset.get(chunkKey);
    hexes.forEach((pos, index) => {
      const hex = this.manager.getHexFromCoord(pos.x, pos.y);
      const hexIndex = this.manager.hexCoordForIndex.get(pos.x, pos.y);
      const terrainType = hex.terrainType;
      if (terrainType === TerrainType.NONE) return;
      const x = hex.posX;
      const y = hex.posY;
      // const tileSections = this.assets.hexSectionTileset.getHexTileSections(this.world, hex);

      // const textures = tileSections.map(tileSection => {
      //   const variants = this.assets.hexSectionTileset.getTexturesForTileSection(tileSection);
      //   if (variants.length === 0) {
      //     return null;
      //   }
      //   // TODO: pick random variant?
      //   return variants[0];
      // });
      // const tx = (x - minX);
      // const ty = (y - OFFSET_Y - minY);
      // for (const texture of textures) {
      //   if (texture) {
      //     terrainLayer.addFrame(texture, tx, ty);
      //   }
      // }

      // overlay
      if (!this.hexOverlaySprites.has(hexIndex)) {
        const overlaySprite = new Sprite(this.assets.hexMask);
        overlaySprite.tint = this.manager.mapMode$.value.setTile(hex.index, this.manager);
        overlaySprite.position.set(x, y);
        overlaySprite.width = this.assets.hexMask.width;
        overlaySprite.height = this.assets.hexMask.height;
        // this.cull.add(overlaySprite as any, true);
        this.overlayLayer.addChild(overlaySprite);
        this.hexOverlaySprites.set(hexIndex, overlaySprite);
      }

      if (!this.hexGridSprites.has(hexIndex)) {
        const gridSprite = new Sprite(this.assets.gridTexture);
        gridSprite.alpha = 0.25;
        gridSprite.position.set(x, y);
        gridSprite.width = this.assets.hexMask.width;
        gridSprite.height = this.assets.hexMask.height;
        // this.cull.add(gridSprite as any, true);
        this.gridLayer.addChild(gridSprite);
        this.hexGridSprites.set(hexIndex, gridSprite);
      }

      for (const dir of directionIndexOrder) {
        if (hex.river[dir] === 1) {
          const riverSprite = new Sprite(this.assets.hexTemplate.getTile(dir));
          riverSprite.tint = DEBUG_RIVER_COLOR;
          riverSprite.position.set(x, y);
          riverSprite.width = this.assets.hexMask.width;
          riverSprite.height = this.assets.hexMask.height;
          this.riversLayer.addChild(riverSprite);
        }
      }

      for (const dir of directionIndexOrder) {
        if (hex.road[dir] === 1) {
          const roadSprite = new Sprite(this.assets.hexTemplate.getTile(6 + dir));
          roadSprite.tint = DEBUG_ROAD_COLOR;
          roadSprite.position.set(x, y);
          roadSprite.width = this.assets.hexMask.width;
          roadSprite.height = this.assets.hexMask.height;
          this.riversLayer.addChild(roadSprite);
        }
      }

      if (this.hexBorderSprites.has(hexIndex)) {
        for (const [dir, sprite] of this.hexBorderSprites.get(hexIndex)) {
          sprite.destroy();
          // this.cull.remove(sprite as any);
          this.regionLayer.removeChild(sprite);
          this.hexBorderSprites.get(hexIndex).delete(dir);
        }
      }

      // if (this.regionMap.hexHasRegion(hexIndex)) {
      //   const region = this.regionMap.getHexRegion(hexIndex);
      //   const tileIDMap = this.regionMap.borderTilesetID.get(hexIndex);
      //   if (tileIDMap === undefined) {
      //     throw new Error('Tile border map not calculated');
      //   }
      //   const hexBorderSprites = new Map<Direction, Sprite>();
      //   for (const dir of directionIndexOrder) {
      //     const tileID = tileIDMap.get(dir);
      //     if (tileID !== undefined) {
      //       const borderSprite = new Sprite(this.assets.borderTileset.getTile(tileID));
      //       borderSprite.position.set(x, y);
      //       borderSprite.width = this.assets.hexMask.width;
      //       borderSprite.height = this.assets.hexMask.height;
      //       this.cull.add(borderSprite as any, true);
      //       this.regionLayer.addChild(borderSprite);
      //       borderSprite.tint = region.color.toNumber();
      //       hexBorderSprites.set(dir, borderSprite);
      //     } else if (this.hexBorderSprites.has(hexIndex)){
      //       const borderSprite = this.hexBorderSprites.get(hexIndex).get(dir);
      //       if (borderSprite) {
      //         borderSprite.destroy();
      //         this.regionLayer.removeChild(borderSprite);
      //       }
      //     }
      //   }
      //   this.hexBorderSprites.set(hexIndex, hexBorderSprites);
      // }

      // icons
      if (this.hexMapIcons.has(hexIndex)) {
        const iconName = this.hexMapIcons.get(hexIndex);
        const mapIcon = new MapIcon(iconName);
        mapIcon.width = this.assets.hexMask.width;
        mapIcon.height = this.assets.hexMask.height;
        mapIcon.position.set(
          x + (this.assets.hexMask.width / 2),
          y + (this.assets.hexMask.height / 2),
        );
        // this.cull.add(mapIcon as any, true);
        this.hexMapIconsSprites.set(hexIndex, mapIcon);
        this.iconsLayer.addChild(mapIcon);
      }
    });
    this.chunkDirty.set(chunkKey, false);

    const timeEnd = Date.now();
    this.chunkDrawTimes.set(chunkKey, timeEnd - timeStart);
  }

  private setupChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    this.chunkLayerToChunk.set(terrainLayer, chunkKey);
    const hexes = this.chunkHexes.get(chunkKey);
    const hexPosititions: [number, number][] = [];
    let minX = Infinity;
    let minY = Infinity;
    for (const pos of hexes) {
      const hex = this.manager.getHexFromCoord(pos.x, pos.y);
      if (hex.posX < minX) minX = hex.posX;
      if (hex.posY < minY) minY = hex.posY;
      hexPosititions.push([hex.posX, hex.posY]);
    }
    this.chunkOffset.set(chunkKey, [minX, minY]);
    this.chunkDirty.set(chunkKey, true);
    (terrainLayer as any).position.set((minX), (minY));
  }

  async render() {
    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new Tilemap([
        this.assets.hexSectionTileset.tilesetTexture,
      ]);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      this.setupChunk(chunkKey);
    }
    // await Promise.all(chunkPromises);
    console.timeEnd('draw chunks');
    console.groupEnd();
  }
}