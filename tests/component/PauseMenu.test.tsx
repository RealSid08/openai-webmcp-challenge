import { fireEvent, render, screen, within } from '@testing-library/react';

import { PauseMenu } from '../../src/components/PauseMenu';

describe('PauseMenu settings', () => {
  it('exposes separate music and effects levels', () => {
    const onAudioChange = vi.fn();
    render(
      <PauseMenu
        onResume={vi.fn()}
        onOpenControls={vi.fn()}
        onOpenMemory={vi.fn()}
        onRestartCheckpoint={vi.fn()}
        onReturnToPairing={vi.fn()}
        audio={{ music: 0.6, effects: 0.8 }}
        onAudioChange={onAudioChange}
        controls={{ mouseSensitivity: 0.7 }}
        onControlsChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), {
      target: { value: '35' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Effects volume' }), {
      target: { value: '50' },
    });

    expect(onAudioChange).toHaveBeenNthCalledWith(1, { music: 0.35, effects: 0.8 });
    expect(onAudioChange).toHaveBeenNthCalledWith(2, { music: 0.6, effects: 0.5 });
  });

  it('offers a non-numeric mouse slider with a default marker and reset action', () => {
    const onControlsChange = vi.fn();
    render(
      <PauseMenu
        onResume={vi.fn()}
        onOpenControls={vi.fn()}
        onOpenMemory={vi.fn()}
        onRestartCheckpoint={vi.fn()}
        onReturnToPairing={vi.fn()}
        audio={{ music: 0.6, effects: 0.8 }}
        onAudioChange={vi.fn()}
        controls={{ mouseSensitivity: 0.45 }}
        onControlsChange={onControlsChange}
      />,
    );

    const lookControls = screen.getByRole('group', { name: 'Look controls' });
    expect(within(lookControls).getByText('Low')).toBeVisible();
    expect(within(lookControls).getByText('Default')).toBeVisible();
    expect(within(lookControls).getByText('High')).toBeVisible();
    expect(within(lookControls).queryByText(/[0-9%]/)).not.toBeInTheDocument();

    fireEvent.change(within(lookControls).getByRole('slider', { name: 'Mouse sensitivity' }), {
      target: { value: '0.5' },
    });
    fireEvent.click(within(lookControls).getByRole('button', { name: 'Reset sensitivity' }));

    expect(onControlsChange).toHaveBeenNthCalledWith(1, { mouseSensitivity: 0.5 });
    expect(onControlsChange).toHaveBeenNthCalledWith(2, { mouseSensitivity: 0.7 });
  });
});
