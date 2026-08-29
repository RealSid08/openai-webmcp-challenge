import type { MinimapSnapshot } from '../game/presentation/minimapModel';

function coordinate(value: number): number {
  return 50 + Math.min(Math.max(value, -1), 1) * 44;
}

function routePoints(snapshot: MinimapSnapshot): string {
  return snapshot.route.map((point) => `${coordinate(point.x)},${coordinate(point.y)}`).join(' ');
}

export function TacticalMinimap({ snapshot }: { snapshot: MinimapSnapshot }) {
  return (
    <figure className={`minimap minimap--${snapshot.mode.toLowerCase()}`}>
      <svg
        className="minimap__surface"
        viewBox="0 0 100 100"
        role="img"
        aria-label={snapshot.accessibleLabel}
      >
        <defs>
          <clipPath id="minimap-disc">
            <circle cx="50" cy="50" r="47" />
          </clipPath>
        </defs>
        <circle className="minimap__back" cx="50" cy="50" r="47" />
        <g clipPath="url(#minimap-disc)">
          <path className="minimap__grid" d="M3 50H97M50 3V97M16 16L84 84M84 16L16 84" />
          <polyline
            data-testid="minimap-route"
            className="minimap__route"
            points={routePoints(snapshot)}
          />
          {snapshot.interactions.map((interaction) => (
            <rect
              key={interaction.id}
              className="minimap__interaction"
              x={coordinate(interaction.x) - 1.8}
              y={coordinate(interaction.y) - 1.8}
              width="3.6"
              height="3.6"
            />
          ))}
          {snapshot.enemies.map((enemy) => (
            <circle
              key={enemy.id}
              data-testid="minimap-enemy"
              className="minimap__enemy"
              cx={coordinate(enemy.x)}
              cy={coordinate(enemy.y)}
              r="2.2"
            />
          ))}
          {snapshot.characters.map((character) => (
            <path
              key={character.id}
              data-testid="minimap-character"
              className={`minimap__character minimap__character--${character.id.toLowerCase()} ${character.controlled ? 'minimap__character--controlled' : ''}`}
              d={`M${coordinate(character.x)},${coordinate(character.y) - 3.2} l-2.5,5.2 h5 z`}
            />
          ))}
          <g
            className={`minimap__objective ${snapshot.objective.edgeArrow ? 'minimap__objective--edge' : ''}`}
            transform={`translate(${coordinate(snapshot.objective.x)} ${coordinate(snapshot.objective.y)}) rotate(${snapshot.objective.angle * (180 / Math.PI)})`}
          >
            <path d="M0 -4 L3.5 3 L0 1.8 L-3.5 3 Z" />
          </g>
        </g>
        <circle className="minimap__ring" cx="50" cy="50" r="47" />
      </svg>
      <figcaption className="minimap__caption">
        <span>{snapshot.mode === 'CHASE' ? 'Route' : 'Tactical'}</span>
        <strong>{snapshot.nextTurn ? `${snapshot.nextTurn.direction} · ${snapshot.nextTurn.distance}` : snapshot.objective.label}</strong>
      </figcaption>
    </figure>
  );
}
