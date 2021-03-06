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
