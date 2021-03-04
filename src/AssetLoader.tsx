import React, { createContext, useEffect, useState } from "react"
import { HexSectionTileset } from "./HexSectionTileset";
import tilesetJson from './assets/tileset.json';
import { HexTemplate } from './HexTemplate';


export type Assets = {
  gridTexture: PIXI.Texture,
  hexTemplate: HexTemplate,
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
    loader.add('gridTexture', require('./assets/grid.png'))
    loader.add('tilesetJSON', tilesetJson)
    const autogenObjectsXML = require('./assets/autogen-objects.xml')
    loader.load(({ resources }) => {
      const assets: Assets = {
        gridTexture: resources.gridTexture.texture,
        hexTemplate: new HexTemplate(resources.hexTemplate),
        hexSectionTileset: new HexSectionTileset(resources.tilesetJSON.data, resources.tilesetPNG.texture.baseTexture),
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