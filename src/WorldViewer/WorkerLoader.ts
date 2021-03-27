import { decode } from 'fast-png';
import { Texture } from 'pixi.js';
import { LoaderType } from './WorldViewer.worker';

export class WorkerLoader {
  promises: Array<Promise<string | ArrayBuffer>> = [];
  assets: { name: string; type: LoaderType; }[] = [];

  add(name: string, type: LoaderType, url: string) {
    if (type === 'png') {
      this.promises.push(
        fetch(url).then(resp => resp.arrayBuffer())
      );
    } else if (type === 'json') {
      this.promises.push(
        fetch(url).then(resp => resp.json())
      );
    }
    this.assets.push({ name, type });
  }

  async load(): Promise<Record<string, any>> {
    const response = await Promise.all(this.promises);
    const resources = {};
    for (const [index, asset] of this.assets.entries()) {
      const assetValue = response[index];
      if (assetValue instanceof ArrayBuffer) {
        const { data, width, height } = decode(assetValue);
        const texture = Texture.fromBuffer(data as any, width, height);
        resources[asset.name] = texture;
      } else {
        resources[asset.name] = assetValue;
      }
    }
    return resources;
  }
}
