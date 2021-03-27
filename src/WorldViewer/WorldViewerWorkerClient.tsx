import { Viewport } from 'pixi-viewport';
import { BehaviorSubject, Subject } from 'rxjs';
import { ModuleThread, spawn, Transfer } from 'threads';
import WorldViewerWorker from 'worker-loader!./WorldViewer.worker.ts';
import { WorldViewerClient } from './WorldViewer.worker';
import { Game } from '../game/simulation/Game';
import { KeyDirection } from './WorldViewer.worker';
import { MapModeType } from './mapMode';
import { createWorkerZoomEvent, createWorkerPointerEvent } from './WorldViewer';
import { Coordinate } from '../types';

export class WorldViewerWorkerClient {
  viewport$: BehaviorSubject<Viewport>;

  public hoverPoint$: Subject<Coordinate> = new Subject();
  public clickPoint$: Subject<Coordinate> = new Subject();

  constructor(
    private game: Game,
    private worker: ModuleThread<WorldViewerClient>
  ) {
    worker.clickPoint$().subscribe(point => {
      // console.log('Clicked on', point);
      this.clickPoint$.next(point);
    });

    worker.hoverPoint$().subscribe(point => {
      // console.log('Hovered on', point);
      this.hoverPoint$.next(point);
    });
  }

  static async create(
    game: Game,
    worldMapCanvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement
  ) {
    const worker = await spawn<WorldViewerClient>(new WorldViewerWorker());
    worldMapCanvas.width = window.innerWidth;
    worldMapCanvas.height = window.innerHeight;

    await worker.init(
      Transfer(worldMapCanvas.transferControlToOffscreen()) as any,
      Transfer(minimapCanvas.transferControlToOffscreen()) as any,
      game.gameMap.sab,
      window.devicePixelRatio
    );

    game.gameMap.worldDirty$.subscribe(() => {
      worker.worldDirty();
    });

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
