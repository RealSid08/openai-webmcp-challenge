import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { App } from '../../src/App';
import { createAppServices, type AppStorage } from '../../src/app/createAppServices';

function createStorage(): AppStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createServices(now: () => number = () => 1_000) {
  let id = 0;
  return createAppServices({
    storage: createStorage(),
    now,
    createId: () => `app-id-${++id}`,
  });
}

describe('App', () => {
  it('publishes the direct agent operating brief in the page and shows pre-mission radio', async () => {
    const services = createServices();
    render(<App services={services} compatibility="SUPPORTED" />);

    expect(screen.getByTestId('agent-partner-brief')).toHaveTextContent('Never start the heist');
    services.coordinator.join('Codex');
    act(() => {
      services.coordinator.publish({
        type: 'AGENT_RADIO',
        summary: 'PLAN: You take the first move. I will cover the other lane.',
      });
    });

    expect(await screen.findByText('You take the first move. I will cover the other lane.')).toBeVisible();
    expect(services.store.getSnapshot().phase).toBe('PAIRING');
    services.destroy();
  });

  it('keeps the heist locked while no WebMCP partner has joined', () => {
    const services = createServices();
    render(<App services={services} compatibility="SUPPORTED" />);

    expect(screen.getByText('WAITING FOR PARTNER')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start heist' })).toBeDisabled();
    services.destroy();
  });

  it('reacts to the real partner session and starts the authored title sequence', () => {
    const services = createServices();
    render(<App services={services} compatibility="SUPPORTED" />);

    act(() => {
      services.coordinator.join('Codex');
    });
    expect(screen.getByText('PARTNER ONLINE')).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Start heist' });
    expect(start).toBeEnabled();

    fireEvent.click(start);
    expect(screen.getByText('RealSid Games Presents')).toBeInTheDocument();
    expect(services.store.getSnapshot().phase).toBe('TITLE');
    services.destroy();
  });

  it('locks the pairing screen again when the agent presence lease expires', async () => {
    let now = 1_000;
    const services = createServices(() => now);
    render(<App services={services} compatibility="SUPPORTED" />);

    act(() => {
      services.coordinator.join('Codex');
    });
    expect(screen.getByRole('button', { name: 'Start heist' })).toBeEnabled();

    now = 31_001;
    await waitFor(() => expect(screen.getByText('WAITING FOR PARTNER')).toBeInTheDocument(), {
      timeout: 500,
    });
    expect(screen.getByRole('button', { name: 'Start heist' })).toBeDisabled();
    services.destroy();
  });

  it('opens inspectable read-only partner memory from pairing', () => {
    const services = createServices();
    render(<App services={services} compatibility="SUPPORTED" />);

    fireEvent.click(screen.getByRole('button', { name: 'Partner memory' }));
    expect(screen.getByRole('dialog', { name: 'Partner memory' })).toBeInTheDocument();
    expect(screen.getByText(/not model training or fine-tuning/i)).toBeInTheDocument();
    services.destroy();
  });

  it('updates the visible memory document after the confirmed pairing-screen reset', () => {
    const services = createServices();
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();
    services.store.damageCharacter('OWEN', 100, 'ENEMY_FIRE');
    const evidence = services.store
      .getSnapshot()
      .history.findLast((event) => event.type === 'CHARACTER_DOWN');
    expect(evidence).toBeDefined();
    services.memory.recordLesson({
      evidenceEventId: evidence?.id ?? '',
      lesson: 'Hold cover until the stairwell is clear.',
      affectedTactic: 'COVER',
    });
    services.store.returnToPairing();
    render(<App services={services} compatibility="SUPPORTED" />);

    fireEvent.click(screen.getByRole('button', { name: 'Partner memory' }));
    expect(screen.getByText(/Hold cover until the stairwell is clear\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset memory' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));

    expect(screen.getByText(/No lessons yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hold cover until the stairwell is clear\./)).not.toBeInTheDocument();
    services.destroy();
  });

  it('makes a free perspective switch visibly cinematic instead of silently teleporting', () => {
    const services = createServices();
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();
    services.store.beginSwitch();

    render(<App services={services} compatibility="SUPPORTED" />);

    const transition = screen.getByRole('status', { name: 'Perspective switching' });
    expect(transition).toHaveTextContent('OWEN');
    expect(transition).toHaveTextContent('CODY');
    services.destroy();
  });

  it('loads mouse sensitivity into the first-run controls and persists changes', async () => {
    window.localStorage.setItem(
      'hs-heist:control-settings',
      JSON.stringify({ mouseSensitivity: 0.4 }),
    );
    const services = createServices();
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();

    render(<App services={services} compatibility="SUPPORTED" />);

    const slider = await screen.findByRole('slider', { name: 'Mouse sensitivity' });
    expect(slider).toHaveValue('0.4');
    fireEvent.change(slider, { target: { value: '0.55' } });

    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('hs-heist:control-settings') ?? '{}'))
        .toMatchObject({ mouseSensitivity: 0.55 }),
    );
    services.destroy();
  });

  it('advances mission deadlines when the Babylon render loop is unavailable', async () => {
    let now = 1_000;
    const services = createServices(() => now);
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();

    render(<App services={services} compatibility="SUPPORTED" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the fight' }));
    act(() => {
      services.store.beginSwitch();
    });
    expect(screen.getByRole('status', { name: 'Perspective switching' })).toBeInTheDocument();

    now = 2_900;
    await waitFor(() => expect(services.store.getSnapshot().humanCharacter).toBe('CODY'), {
      timeout: 500,
    });
    expect(screen.queryByRole('status', { name: 'Perspective switching' })).not.toBeInTheDocument();
    services.destroy();
  });
});
