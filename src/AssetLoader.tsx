import React, { createContext, useEffect, useState } from "react"
import { Tileset } from './Tileset';
import { AutogenObjectTile } from './types';


export type Assets = {
  hexTemplate: PIXI.LoaderResource,
  autogenObjects: Tileset<AutogenObjectTile>,
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
    const autogenObjectsXML = require('./assets/autogen-objects.xml')
    loader.load(({ resources }) => {
      const assets: Assets = {
        hexTemplate: resources.hexTemplate,
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
      setAssets(assets);
    });
  }, []);

  return (
    <AssetContext.Provider value={{ isLoading, assets }}>
      {children}
    </AssetContext.Provider>
  );
}