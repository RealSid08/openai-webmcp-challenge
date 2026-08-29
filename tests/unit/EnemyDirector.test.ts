import { EnemyDirector, type EnemyWorldSnapshot } from '../../src/game/systems/EnemyDirector';

function world(visible = true): EnemyWorldSnapshot {
  return {
    tutorialProtected: false,
    targets: [
      { id: 'OWEN', position: { x: 0, z: 0 }, health: 100, moving: false, exposed: true },
      { id: 'CODY', position: { x: 4, z: 1 }, health: 75, moving: true, exposed: true },
    ],
    covers: [
      { id: 'cover-a', position: { x: -3, z: 5 }, occupied: false, exposure: 0.2 },
      { id: 'cover-b', position: { x: 4, z: 6 }, occupied: false, exposure: 0.5 },
    ],
    hasLineOfSight: () => visible,
  };
}

describe('EnemyDirector', () => {
  it('never fires through occlusion', () => {
    const director = new EnemyDirector({ random: () => 0.2 });
    director.register({ id: 'guard-1', position: { x: 0, z: 8 }, state: 'ACQUIRE' });
    const commands = director.update(world(false), 2);

    expect(commands.some((command) => command.type === 'FIRE_SHOT')).toBe(false);
    expect(director.getState('guard-1')?.state).not.toBe('BURST');
  });

  it('telegraphs before firing a short bounded burst', () => {
    const director = new EnemyDirector({ random: () => 0.15 });
    director.register({ id: 'guard-1', position: { x: 0, z: 8 }, state: 'ACQUIRE' });
    const events: string[] = [];
    for (let time = 0; time < 4; time += 0.1) {
      events.push(...director.update(world(true), 0.1).map((command) => command.type));
    }

    expect(events).toContain('BEGIN_TELEGRAPH');
    expect(events.indexOf('BEGIN_TELEGRAPH')).toBeLessThan(events.indexOf('FIRE_SHOT'));
    expect(events.filter((event) => event === 'FIRE_SHOT').length).toBeGreaterThanOrEqual(2);
    expect(events.filter((event) => event === 'FIRE_SHOT').length).toBeLessThanOrEqual(6);
  });

  it('moves toward the safest unoccupied authored cover before acquiring', () => {
    const director = new EnemyDirector({ random: () => 0.4 });
    director.register({ id: 'guard-1', position: { x: 0, z: 12 }, state: 'SEEK' });
    const commands = director.update(world(true), 0.1);
    const move = commands.find((command) => command.type === 'MOVE_TO');

    expect(move).toMatchObject({ type: 'MOVE_TO', enemyId: 'guard-1', destination: { x: -3, z: 5 } });
  });

  it('suppresses lethal shots while interactive training is active', () => {
    const protectedWorld = { ...world(true), tutorialProtected: true };
    const director = new EnemyDirector({ random: () => 0 });
    director.register({ id: 'guard-1', position: { x: 0, z: 8 }, state: 'TELEGRAPH', stateTime: 1 });

    expect(director.update(protectedWorld, 1).some((command) => command.type === 'FIRE_SHOT')).toBe(false);
  });

  it('reserves different cover nodes for enemies updating together', () => {
    const director = new EnemyDirector({ random: () => 0.4 });
    director.register({ id: 'guard-1', position: { x: 0, z: 12 }, state: 'SEEK' });
    director.register({ id: 'guard-2', position: { x: 1, z: 13 }, state: 'SEEK' });
    const destinations = director
      .update(world(true), 0.1)
      .filter((command) => command.type === 'MOVE_TO')
      .map((command) => command.destination);

    expect(new Set(destinations.map((point) => `${point.x}:${point.z}`)).size).toBe(2);
  });
});
