import { TilesetDefinition, HexTileSection, HexTileSectionVariant, TilesetDefinitionTile, getSectionTileID, TileSectionTypeMap, TileSectionEdgeMap, TileSectionType, centerTypeEdges, sectionTypeToDirection, edgeSectionTypes, centerEdgeToDirection, TileSectionEdge, tileSectionRenderOrder, tileSectionTypeTitles, tileSectionEdgeTitles } from '../game/world/hexTile';
import { MultiMap } from '../utils/MultiMap';
import { Hex, World } from '../game/world/World';
import { DirectionMap, directionIndexOrder, adjacentDirections } from '../types';
import { terrainTransitions, TerrainType, terrainTypeTitles } from '../game/world/terrain';


export class HexSectionTileset {
  /**
   * Map of hex section IDs to available variants
   */
  tileSectionVariants: MultiMap<number, {
    texture: PIXI.Texture,
    tileDef: TilesetDefinitionTile
  }>;

  constructor(
    def: TilesetDefinition,
    public tilesetTexture: PIXI.BaseTexture,
  ) {
    this.tileSectionVariants = new MultiMap();

    const { columns, tileSize, tilePadding } = def;
    for (const tileVariant of def.tiles) {
      const x = Math.round((tileVariant.index % columns) * (tileSize.width + tilePadding));
      const y = Math.round((Math.floor(tileVariant.index / columns)) * (tileSize.height + tilePadding))
      const texture = new PIXI.Texture(
        tilesetTexture,
        new PIXI.Rectangle(x, y, tileSize.width, tileSize.height)
      );
      this.tileSectionVariants.add(tileVariant.variant.id, {
        texture,
        tileDef: tileVariant,
      });
    }
  }

  debugTileSection(tileSection: HexTileSection) {
    const data = {};
    data['Terrain type'] = `${terrainTypeTitles[tileSection.terrainType]} (${tileSection.terrainType})}`;
    data['Section type'] = `${tileSectionTypeTitles[tileSection.type]} (${tileSection.type})`;
    if (tileSection.edgeTerrainTypes) {
      for (const [key, value] of Object.entries(tileSection.edgeTerrainTypes)) {
        data[`Edge ${tileSectionEdgeTitles[key]} (${key})`] = terrainTypeTitles[value];
      }
    }
    return data;
  };

  /**
   * Gets the available textures from for this tile section
   * @param tileSection HexTileSection
   */
  getTexturesForTileSection(
    tileSection: HexTileSection,
  ) {
    const id = getSectionTileID(tileSection);
    if (this.tileSectionVariants.has(id)) {
      return this.tileSectionVariants.get(id).map(i => i.texture);
    }
    // console.warn(`Hex section tile texture not found for ID ${id}`);
    // console.log(this.debugTileSection(tileSection));
    return [];
  }

  getHexTileSections(world: World, hex: Hex) {
    const sections: Map<TileSectionType, HexTileSection> = new Map();
    // center section
    const terrainType = world.getTerrainForCoord(hex.x, hex.y);
    const neighborTerrainTypes = world.getHexNeighborTerrain(hex.x, hex.y);

    /**
     * for the purposes of the tileset, build a map of neighbor terain types
     * based on the terrain transition map, and also treat rivers as edge terrain types
     */
    for (let direction of directionIndexOrder) {
      const edgeTerrainType = neighborTerrainTypes[direction];
      if (!(
        terrainTransitions[terrainType] && 
        terrainTransitions[terrainType].includes(edgeTerrainType)
      )) {
        neighborTerrainTypes[direction] = terrainType;
      }
    }
    if (world.hexRiverEdges.containsKey(hex)) {
      const riverDirections = world.hexRiverEdges.getValue(hex);
      for (let dir of riverDirections) {
        neighborTerrainTypes[dir] = TerrainType.RIVER;
      }
    }

    // find hex sections

    // find roads
    let hexEdgeRoads: Partial<DirectionMap<boolean>> = {};
    for (const direction of directionIndexOrder) {
      hexEdgeRoads[direction] = world.hasRoad(hex, direction);
    }

    const centerEdgeRoads: Partial<TileSectionEdgeMap<boolean>> = {};
    for (const edgeType of centerTypeEdges) {
      const dir = centerEdgeToDirection.get(edgeType);
      centerEdgeRoads[edgeType] = hexEdgeRoads[dir] ?? false;
    }
    const tileSection: HexTileSection = {
      type: TileSectionType.CENTER,
      terrainType,
      edgeRoads: centerEdgeRoads,
    }; 
    sections.set(TileSectionType.CENTER, tileSection);

    for (const sectionType of edgeSectionTypes) {
      const dir = sectionTypeToDirection.get(sectionType);
      const hexEdgeTerrainType = neighborTerrainTypes[dir];
      const edgeTerrainTypes: Partial<TileSectionEdgeMap<TerrainType>> = {};
      edgeTerrainTypes[TileSectionEdge.CENTER] = terrainType;
      edgeTerrainTypes[TileSectionEdge.EDGE] = hexEdgeTerrainType;
      const [adj1, adj2] = adjacentDirections[dir];
      const adj1TerrainType = neighborTerrainTypes[adj1];
      const adj2TerrainType = neighborTerrainTypes[adj2];
      edgeTerrainTypes[TileSectionEdge.ADJ1] = adj1TerrainType;
      edgeTerrainTypes[TileSectionEdge.ADJ2] = adj2TerrainType;
      const edgeHex = world.getHexNeighbor(hex.x, hex.y, dir);
      const adj1Hex = world.getHexNeighbor(hex.x, hex.y, adj1);
      const adj2Hex = world.getHexNeighbor(hex.x, hex.y, adj2);
      if (hexEdgeTerrainType !== TerrainType.RIVER) {
        if (world.riverHexPairs.has(adj1Hex) && world.riverHexPairs.get(adj1Hex).has(edgeHex)) {
          edgeTerrainTypes[TileSectionEdge.ADJ1] = world.isLand(hex) ? TerrainType.RIVER_SOURCE : TerrainType.RIVER_MOUTH;
        }
        if (world.riverHexPairs.has(adj2Hex) && world.riverHexPairs.get(adj2Hex).has(edgeHex)) {
          edgeTerrainTypes[TileSectionEdge.ADJ2] = world.isLand(hex) ? TerrainType.RIVER_SOURCE : TerrainType.RIVER_MOUTH;
        }
      }


      let edgeRoads: Partial<TileSectionEdgeMap<boolean>> = {};
      if (hexEdgeRoads[dir]) {
        edgeRoads[TileSectionEdge.CENTER] = true;
        edgeRoads[TileSectionEdge.EDGE] = true;
      }
      const tileSection: HexTileSection = {
        type: sectionType,
        terrainType,
        edgeTerrainTypes,
        edgeRoads,
      };
      sections.set(sectionType, tileSection);
    }

    return tileSectionRenderOrder.map(sectionType => {
      return sections.get(sectionType);
    });
  }
}