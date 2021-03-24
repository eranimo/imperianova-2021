import { Viewport } from 'pixi-viewport';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { BehaviorSubject } from 'rxjs';
import { ModuleThread, spawn, Transfer } from 'threads';
import WorldViewerWorker from 'worker-loader!./WorldViewer.worker.ts';
import { GameContext } from '../ui/pages/GameView';
import type { WorldViewerClient } from './WorldViewer.worker';
import { Game } from '../game/simulation/Game';
import { WorldMapState, WorldMapStateHex } from './worldMapState';
import { useEvent, useWindowSize } from 'react-use';
import { KeyDirection } from './WorldViewer.worker';
import { Direction, directionIndexOrder } from '../types';
import { MapModeType } from './mapMode';


const createWorkerPointerEvent = (event: PointerEvent) => ({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  button: event.button,
  x: event.offsetX,
  y: event.offsetY,
});

const createWorkerZoomEvent = (e: WheelEvent) => ({
  deltaX: e.deltaX,
  deltaY: e.deltaY,
  deltaZ: e.deltaZ,
  deltaMode: e.deltaMode,
  x: e.x,
  y: e.y,
});


class WorldViewerWorkerClient {
  viewport$: BehaviorSubject<Viewport>;

  constructor(
    private game: Game,
    private worker: ModuleThread<WorldViewerClient>
  ) {

  }

  static async create(
    game: Game,
    worldMapCanvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
  ) {
    const worker = await spawn<WorldViewerClient>(new WorldViewerWorker());
    worldMapCanvas.width = window.innerWidth;
    worldMapCanvas.height = window.innerHeight;

    // create world map state
    console.log('Game', game);
    const hexes: WorldMapStateHex[] = [];
    for (const hex of game.world.hexgrid) {
      const river = {
        [Direction.SE]: 0,
        [Direction.NE]: 0,
        [Direction.N]: 0,
        [Direction.NW]: 0,
        [Direction.SW]: 0,
        [Direction.S]: 0,
      };
      if (game.world.riverHexPairs.has(hex)) {
        for (const dir of directionIndexOrder) {
          const neighbor = game.world.getHexNeighbor(hex.x, hex.y, dir);
          river[dir] = Number(game.world.riverHexPairs.get(hex).has(neighbor));
        }
      }
      const road = {
        [Direction.SE]: 0,
        [Direction.NE]: 0,
        [Direction.N]: 0,
        [Direction.NW]: 0,
        [Direction.SW]: 0,
        [Direction.S]: 0,
      };
      if (game.world.hexRoads.has(hex)) {
        for (const dir of directionIndexOrder) {
          road[dir] = Number(game.world.hexRoads.get(hex).has(dir));
        }
      }
      const pos = game.world.getHexPosition(hex.x, hex.y);
      hexes.push({
        index: hex.index,
        terrainType: game.world.getTerrain(hex),
        population: 0,
        coordX: hex.x,
        coordY: hex.y,
        posX: pos[0],
        posY: pos[1],
        river: river as any,
        road: road as any,
      })
    }
    const worldMapStateRaw = {
      hexWidth: game.world.gridSize.width,
      hexHeight: game.world.gridSize.height,
      pointWidth: game.world.hexgrid.pointWidth(),
      pointHeight: game.world.hexgrid.pointHeight(),
      hexes,
      // regions: [], 
    }
    const length = WorldMapState.getLength(worldMapStateRaw);
    const sab = new SharedArrayBuffer(length);
    const worldMapState = WorldMapState.from(worldMapStateRaw, new DataView(sab));

    await worker.init(
      Transfer(worldMapCanvas.transferControlToOffscreen()) as any,
      Transfer(minimapCanvas.transferControlToOffscreen()) as any,
      sab,
      window.devicePixelRatio,
    );

    return new WorldViewerWorkerClient(game, worker);
  }

  viewportMove(keys: Record<KeyDirection, boolean>) {
    this.worker.viewportMove(keys);
  }

  viewportResize(width: number, height: number) {
    console.log('(client) window resize');
    this.worker.viewportResize(width, height);
  }

  viewportZoom(event: WheelEvent) {
    this.worker.viewportZoom(createWorkerZoomEvent(event));
  }

  viewportPointerDown(event: PointerEvent) {
    this.worker.viewportPointerDown(createWorkerPointerEvent(event));
  }

  viewportPointerMove(event: PointerEvent) {
    this.worker.viewportPointerMove(createWorkerPointerEvent(event));
  }

  viewportPointerUp(event: PointerEvent) {
    this.worker.viewportPointerUp(createWorkerPointerEvent(event));
  }

  viewportPointerCancel(event: PointerEvent) {
    this.worker.viewportPointerCancel(createWorkerPointerEvent(event));
  }

  viewportPointerOut(event: PointerEvent) {
    this.worker.viewportPointerOut(createWorkerPointerEvent(event));
  }

  minimapPointerUp(event: PointerEvent) {
    this.worker.minimapPointerUp(createWorkerPointerEvent(event));
  }

  minimapPointerDown(event: PointerEvent) {
    this.worker.minimapPointerDown(createWorkerPointerEvent(event));
  }

  minimapPointerMove(event: PointerEvent) {
    this.worker.minimapPointerMove(createWorkerPointerEvent(event));
  }

  minimapPointerOut(event: PointerEvent) {
    this.worker.minimapPointerOut(createWorkerPointerEvent(event));
  }

  changeMapMode(mapModeType: MapModeType) {
    this.worker.changeMapMode(mapModeType);
  }
}

export const WorldViewer = () => {
  const game = useContext(GameContext);
  const worldMapRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();
  const [isLoading, setLoading] = useState(true);

  const managerRef = useRef<WorldViewerWorkerClient>();

  useEffect(() => {
    console.log('setup world manager');
    setLoading(true);
    WorldViewerWorkerClient.create(game, worldMapRef.current, minimapRef.current).then((manager) => {
      managerRef.current = manager;
      setLoading(false);

      game.mapMode$.subscribe((mapModeType) => {
        managerRef.current.changeMapMode(mapModeType);
      });

      // viewport events
      worldMapRef.current.addEventListener('wheel', (e) => {
        managerRef.current.viewportZoom(e);
      }, { passive: true });
      worldMapRef.current.addEventListener('pointerdown', (e) => {
        managerRef.current.viewportPointerDown(e);
      });
      worldMapRef.current.addEventListener('pointermove', (e) => {
        managerRef.current.viewportPointerMove(e);
      });
      worldMapRef.current.addEventListener('pointerup', (e) => {
        managerRef.current.viewportPointerUp(e);
      });
      worldMapRef.current.addEventListener('pointercancel', (e) => {
        managerRef.current.viewportPointerCancel(e);
      });
      worldMapRef.current.addEventListener('pointerout', (e) => {
        managerRef.current.viewportPointerOut(e);
      });

      // minimap events
      minimapRef.current.addEventListener('pointerup', e => {
        managerRef.current.minimapPointerUp(e);
      });
      minimapRef.current.addEventListener('pointerdown', e => {
        managerRef.current.minimapPointerDown(e);
      });
      minimapRef.current.addEventListener('pointermove', e => {
        managerRef.current.minimapPointerMove(e);
      });
      minimapRef.current.addEventListener('pointerout', e => {
        managerRef.current.minimapPointerOut(e);
      });
    });
  }, []);

  const keysPressed = useRef<Record<KeyDirection, boolean>>({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  useEvent('keydown', event => {
    if (event.target.nodeName === 'BODY') {
      if (event.key === 'w' || event.key === 'ArrowUp') {
        keysPressed.current.up = true;
      }
      if (event.key === 's' || event.key === 'ArrowDown') {
        keysPressed.current.down = true;
      }
      if (event.key === 'a' || event.key === 'ArrowLeft') {
        keysPressed.current.left = true;
      }
      if (event.key === 'd' || event.key === 'ArrowRight') {
        keysPressed.current.right = true;
      }
      managerRef.current.viewportMove(keysPressed.current);
    }
  });
  useEvent('keyup', event => {
    if (event.target.nodeName === 'BODY') {
      if (event.key === 'w' || event.key === 'ArrowUp') {
        keysPressed.current.up = false;
      }
      if (event.key === 's' || event.key === 'ArrowDown') {
        keysPressed.current.down = false;
      }
      if (event.key === 'a' || event.key === 'ArrowLeft') {
        keysPressed.current.left = false;
      }
      if (event.key === 'd' || event.key === 'ArrowRight') {
        keysPressed.current.right = false;
      }
    }
  });

  const { width, height } = useWindowSize();
  useEffect(() => {
    if (managerRef.current && worldMapRef.current) {
      managerRef.current.viewportResize(width, height);
    }
  }, [width, height]);

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
