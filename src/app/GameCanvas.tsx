import { useEffect, useRef, useState } from 'react';

import type { AppServices } from './createAppServices';
import type { GameRuntimeStatus } from '../game/BabylonGameRuntime';
import type { AudioSettings } from '../audio/AdaptiveAudioDirector';

interface GameCanvasProps {
  services: AppServices;
  onStatus: (status: GameRuntimeStatus) => void;
  audioSettings: AudioSettings;
}

export function GameCanvas({ services, onStatus, audioSettings }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<import('../game/BabylonGameRuntime').BabylonGameRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointerState, setPointerState] = useState<GameRuntimeStatus['pointerLock']>({
    state: 'IDLE',
    canRetry: true,
    dragFallback: true,
    message: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let disposeRuntime: (() => void) | null = null;

    void import('../game/BabylonGameRuntime')
      .then(({ BabylonGameRuntime }) => {
        if (disposed) return;
        const runtime = new BabylonGameRuntime({
          canvas,
          services,
          onStatus: (status) => {
            setPointerState(status.pointerLock);
            onStatus(status);
          },
          audioSettings,
        });
        runtimeRef.current = runtime;
        disposeRuntime = () => {
          runtimeRef.current = null;
          runtime.dispose();
        };
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

  useEffect(() => {
    runtimeRef.current?.setAudioSettings(audioSettings);
  }, [audioSettings]);

  return (
    <div className="game-canvas-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="HS: Heist first-person game"
        tabIndex={0}
      />
      {pointerState.state !== 'LOCKED' ? (
        <button
          type="button"
          className="take-control"
          onClick={() => void runtimeRef.current?.requestControl()}
        >
          <strong>{pointerState.state === 'DENIED' ? 'MOUSE CAPTURE DENIED' : 'TAKE CONTROL'}</strong>
          <span>
            {pointerState.message ?? 'Click to capture the mouse. A controller works without capture.'}
          </span>
        </button>
      ) : null}
      {error ? (
        <div className="runtime-error" role="alert">
          <strong>3D RUNTIME OFFLINE</strong>
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
