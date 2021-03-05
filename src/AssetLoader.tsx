import React, { createContext, useEffect, useState } from "react"
import { HexSectionTileset } from "./HexSectionTileset";
import tilesetJson from './assets/tileset.json';
import { HexTemplate } from './HexTemplate';
import { Tileset } from './Tileset';

export type Assets = {
  borderTileset: Tileset,
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
    loader.add('borderTileset', require('./assets/borders.png'))
    loader.add('tilesetJSON', tilesetJson)
    loader.load(({ resources }) => {
      const assets: Assets = {
        borderTileset: new Tileset(resources.borderTileset.texture.baseTexture, {
          tileSize: { width: 64, height: 60 },
          columns: 6,
          tilePadding: 0,
        }),
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