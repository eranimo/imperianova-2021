import { Viewport } from 'pixi-viewport';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { BehaviorSubject } from 'rxjs';
import { ModuleThread, spawn, Transfer } from 'threads';
import WorldViewerWorker from 'worker-loader!./WorldViewer.worker.ts';
import { GameContext } from '../ui/pages/GameView';
import type { WorldViewerClient } from './WorldViewer.worker';

class WorldMapManager {
  viewport$: BehaviorSubject<Viewport>;

  constructor(private worker: ModuleThread<WorldViewerClient>) {

  }

  static async create(
    worldMapCanvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
  ) {
    const worker = await spawn<WorldViewerClient>(new WorldViewerWorker());
    worldMapCanvas.width = window.innerWidth;
    worldMapCanvas.height = window.innerHeight;
    await worker.init(
      Transfer(worldMapCanvas.transferControlToOffscreen()) as any,
      Transfer(minimapCanvas.transferControlToOffscreen()) as any,
    );

    return new WorldMapManager(worker);
  }
}

export const WorldViewer = () => {
  const game = useContext(GameContext);
  const worldMapRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();
  const [isLoading, setLoading] = useState(true);

  const manager = useRef<WorldMapManager>();

  useEffect(() => {
    console.log('setup world manager');
    setLoading(true);
    WorldMapManager.create(worldMapRef.current, minimapRef.current).then((manager) => {
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <canvas
        ref={worldMapRef}
        style={{
          position: 'fixed',
          width: '100%',
          height: '100%',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: 300,
          height: 150,
          zIndex: 10,
        }}
      >
        <canvas
          ref={minimapRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}
