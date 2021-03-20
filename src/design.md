# Design

- World: logical representation of a World
- WorldGenerator: Generates world data for World
- WorldViewer: PixiJS Application.
- WorldRenderer

### Folder structure
- assets/ (images and data files)
- utils/ (common utility classes)
- game/ (game files)
  - world/ (world and world generator)
  - simulation/ (ECS)
    - entities/ 
    - components/
    - systems/
- pages/ (core game ui)
- WorldViewer/ (world map renderer)

## World Generator
### Biomes and terrain types
- A tile has a terrain type
- A group of contiguous tiles exists in a Biome
- Terrain types are determined by Biome

__Biomes__
- Temperate broadleaf and mixed forests
  - Broadleaf trees
  - Mixed trees
  - Temperate grass
- Temperate grasslands, savannas, and shrublands
  - grass
  - shrubs
- Temperate coniferous forests
  - coniferous trees
- Boreal forests
  - coniferous trees
- Desert
  - Barren desert
  - Dry shrubs
  - Desert dunes
  - Desert oasis
- Arid Grassland
  - Arid grassland
  - arid 

__Rivers__
- Lakes in center of hex
- Lakes connected to rivers
  - start of rivers
  - middle of rivers
- river banks
  - rocky
  - sandy
  - marshy
  - cliff
- river crossings (fords)
- river islands
- rocks inside river

__Roads__
- bridges


## Game

AI algorithms:
- [ ] Decision trees and state machines for simple AI
  https://github.com/oguzeroglu/Ego
- [ ] Hierarchical task network for complex action planning
- [ ] Utility AI for goal selection
  https://bitbucket.org/dananau/pyhop/src/master/
  https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter12_Exploring_HTN_Planners_through_Example.pdf
- [ ] A* for pathfinding
- [ ] quad-tree for spacial indexing

Architecture:
- [x] ECS
- [ ] DataType (json-based type classes)

### Simulation 1.0
- Pops represent a single segment of the population living in one area. Its size represents the number of families of that type.
- Pops exist on Tiles.
- Pops have a size. They grow by 0.005% per month
- Pops have Actions.
  - An operation has an optional input resource(s), output resource(s), and a cycle. Output is proportional to size of Pops.
  - List of actions:
    - Foraging: gathers Food Resources from current Tile
- Pops independently decide what action to take based on their current state

### Game init
- Generate 10 random Polities at 10 random land hexes
- Generate Tile for each hex
- Generate 1 Pop for reach Tile


### Architecture
__Entities__
Entities are pieces of data with an ID that can be observed, serialized, and referenced to by other entities.

- Meta
  - handles date
- World
  - logical representation of the game world
  - produced by WorldGenerator
- Polity
  - primary unit of the game. Conceptually represents a state, tribe, or chiefdom
  - contain many Tiles
  - exists on the Map
- Tile
  - a hexagon cell in the world
  - exists on the Map
  - contains information related to roads, rivers, terrain type
- Building
  - exist on Tiles
- Resource
  - represent natural resources that can be exploited by polities
  - exist on Tiles
- Pop
  - represents
  - exist on Tiles
- Unit
  - exists on the Map

__Components__
- Position (world coordinate)
- HexPosition (hex grid coordinate)
- TileData
- PolityData
- WorldData
- MetaData
- UnitData
- UnitUI
- ResourceData

__Systems__
Systems are functions that operate on one or more entities that perform a specific function.

- MovementSystem
  - moves units on the map
- PolitySystem

__Context__
- WorldMap: renders the world map
- WorldGrid: pathfinding
