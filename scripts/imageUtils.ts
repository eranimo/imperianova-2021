import Jimp from "jimp";
import path from 'path';


export async function newImage(width: number, height: number): Promise<Jimp> {
  return new Promise((resolve, reject) => {
    new Jimp(width, height, (err, image) => {
      if (err) {
        reject(err);
      } else {
        resolve(image);
      }
    })
  })
}

export function getFilePath(...paths: string[]) {
  return path.resolve(__dirname, '../', ...paths);
}