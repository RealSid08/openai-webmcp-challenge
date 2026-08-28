import { useEffect, useRef, useState } from 'react';

import type { AppServices } from './createAppServices';
import type { GameRuntimeStatus } from '../game/BabylonGameRuntime';

interface GameCanvasProps {
  services: AppServices;
  onStatus: (status: GameRuntimeStatus) => void;
}

export function GameCanvas({ services, onStatus }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let disposeRuntime: (() => void) | null = null;

    void import('../game/BabylonGameRuntime')
      .then(({ BabylonGameRuntime }) => {
        if (disposed) return;
        const runtime = new BabylonGameRuntime({ canvas, services, onStatus });
        disposeRuntime = () => runtime.dispose();
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : 'The 3D runtime could not start.');
        }
      });

    return () => {
      disposed = true;
      disposeRuntime?.();
    };
  }, [onStatus, services]);

  return (
    <div className="game-canvas-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="HS: Heist first-person game" />
      {error ? (
        <div className="runtime-error" role="alert">
          <strong>3D RUNTIME OFFLINE</strong>
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
