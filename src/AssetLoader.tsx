import React, { createContext, useEffect, useState } from "react"
import { HexSectionTileset } from "./HexSectionTileset";
import { Tileset } from './Tileset';
import { AutogenObjectTile } from './types';
import tilesetJson from './assets/tileset.json';


export type Assets = {
  hexTemplate: PIXI.LoaderResource,
  autogenObjects: Tileset<AutogenObjectTile>,
  hexSectionTileset: HexSectionTileset,
};

interface IAssetContext {
  isLoading: boolean,
  assets: Assets | null
}
export const AssetContext = createContext<IAssetContext>({
  isLoading: false,
  assets: null,
});

export const AssetLoader = ({
  children,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    const loader = new PIXI.Loader();
    loader.add('hexTemplate', require('./assets/hex-template.png'))
    loader.add('autogenObjectsPNG', require('./assets/autogen-objects.png'))
    loader.add('tilesetPNG', require('./assets/tileset.png'))
    loader.add('tilesetJSON', tilesetJson)
    const autogenObjectsXML = require('./assets/autogen-objects.xml')
    loader.load(({ resources }) => {
      const assets: Assets = {
        hexTemplate: resources.hexTemplate,
        hexSectionTileset: new HexSectionTileset(resources.tilesetJSON.data, resources.tilesetPNG.texture.baseTexture),
        autogenObjects: new Tileset<AutogenObjectTile>(
          resources.autogenObjectsPNG.texture,
          autogenObjectsXML,
          data => ({
            size: parseInt(data.size, 10),
            terrainTypes: data.terrainTypes
              ? data.terrainTypes.split(',').map(t => parseInt(t, 10))
              : [],
            used: data.used === 'true',
          })
        ),
      };
      console.log('assets', assets);
      setAssets(assets);
    });
  }, []);

  return (
    <AssetContext.Provider value={{ isLoading, assets }}>
      {children}
    </AssetContext.Provider>
  );
}