import { render, screen } from '@testing-library/react';

import { TacticalMinimap } from '../../src/components/TacticalMinimap';

describe('TacticalMinimap', () => {
  it('renders route, objective, both characters, and detected enemies accessibly', () => {
    render(
      <TacticalMinimap
        snapshot={{
          mode: 'FACILITY',
          route: [{ x: 0, y: 0.5 }, { x: 0.2, y: -0.4 }],
          characters: [
            { id: 'OWEN', x: 0, y: 0, controlled: true },
            { id: 'CODY', x: 0.2, y: 0.1, controlled: false },
          ],
          enemies: [{ id: 'guard-1', x: -0.2, y: -0.4 }],
          interactions: [],
          objective: { x: 0, y: -0.88, label: 'Blast gate', edgeArrow: true, angle: 0 },
          accessibleLabel: 'Objective Blast gate is ahead. One enemy detected.',
          nextTurn: null,
        }}
      />,
    );

    expect(screen.getByRole('img', { name: /objective blast gate is ahead/i })).toBeInTheDocument();
    expect(screen.getByTestId('minimap-route')).toBeInTheDocument();
    expect(screen.getAllByTestId('minimap-character')).toHaveLength(2);
    expect(screen.getByTestId('minimap-enemy')).toBeInTheDocument();
  });
});
