import React, { useContext, useEffect, useRef, useState } from 'react';
import { GameContext } from '../ui/pages/GameView';
import { WorldMapState, WorldMapStateHex } from './worldMapState';
import { useEvent, useWindowSize } from 'react-use';
import { KeyDirection } from './WorldViewer.worker';
import { Direction, directionIndexOrder, Coordinate } from '../types';
import { WorldViewerWorkerClient } from './WorldViewerWorkerClient';
import { MapModeTooltip } from './MapModeTooltip';
import { MapModeType } from './mapMode';
import { GridFactory } from '../game/world/World';


export const createWorkerPointerEvent = (event: PointerEvent) => ({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  button: event.button,
  x: event.offsetX,
  y: event.offsetY,
});

export const createWorkerZoomEvent = (e: WheelEvent) => ({
  deltaX: e.deltaX,
  deltaY: e.deltaY,
  deltaZ: e.deltaZ,
  deltaMode: e.deltaMode,
  x: e.x,
  y: e.y,
});


const TooltipContainer = ({
  worldPosition,
  position,
  mapMode,
}: {
  worldPosition: Coordinate,
  position: Coordinate,
  mapMode: MapModeType,
}) => {
  const game = useContext(GameContext);
  const [hexIndex, setHexIndex] = useState<number>(null);

  useEffect(() => {
    const hexPosition = GridFactory.pointToHex(worldPosition);
    const hex = game.world.getHex(hexPosition.x, hexPosition.y);
    if (hex) {
      setHexIndex(hex.index);
    }
  }, [worldPosition]);

  if (!hexIndex || !position || !worldPosition) {
    return null;
  }

  return (
    <MapModeTooltip
      gameMap={game.context.gameMap}
      mapMode={mapMode}
      hexIndex={hexIndex}
      position={position}
    />
  );
}

export const WorldViewer = () => {
  const game = useContext(GameContext);
  const worldMapRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();
  const [isLoading, setLoading] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState<Coordinate>(null);
  const [worldPosition, setWorldPosition] = useState<Coordinate>(null);
  const [mapMode, setMapMode] = useState(null);
  const managerRef = useRef<WorldViewerWorkerClient>();
  const isPanning = useRef(false);

  useEffect(() => {
    console.log('setup world manager');
    setLoading(true);
    WorldViewerWorkerClient.create(game, worldMapRef.current, minimapRef.current).then((manager) => {
      managerRef.current = manager;
      setLoading(false);

      game.mapMode$.subscribe((mapModeType) => {
        setMapMode(mapModeType);
        managerRef.current.changeMapMode(mapModeType);
      });

      manager.hoverPoint$.subscribe(point => {
        setWorldPosition(point);
      });

      manager.clickPoint$.subscribe(point => {
        console.log('Clicked on point', point);
      });

      // viewport events
      worldMapRef.current.addEventListener('wheel', (e) => {
        managerRef.current.viewportZoom(e);
      }, { passive: true });
      worldMapRef.current.addEventListener('pointerdown', (e) => {
        managerRef.current.viewportPointerDown(e);
        isPanning.current = true;
        setWorldPosition(null);
        setTooltipPosition(null)
      });
      worldMapRef.current.addEventListener('pointermove', (e) => {
        managerRef.current.viewportPointerMove(e);
        if (!isPanning.current) {
          setTooltipPosition({
            x: e.clientX,
            y: e.clientY,
          });
        }
      });
      worldMapRef.current.addEventListener('pointerup', (e) => {
        managerRef.current.viewportPointerUp(e);
        isPanning.current = false;
      });
      worldMapRef.current.addEventListener('pointercancel', (e) => {
        managerRef.current.viewportPointerCancel(e);
      });
      worldMapRef.current.addEventListener('pointerout', (e) => {
        managerRef.current.viewportPointerOut(e);
        setWorldPosition(null);
        setTooltipPosition(null)
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
    if (!managerRef.current) return;
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
    if (!managerRef.current) return;
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
    <div style={{ overflow: 'hidden' }}>
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
      <TooltipContainer
        worldPosition={worldPosition}
        position={tooltipPosition}
        mapMode={mapMode}
      />
    </div>
  );
}
