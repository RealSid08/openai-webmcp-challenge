import { fireEvent, render, screen } from '@testing-library/react';

import { PauseMenu } from '../../src/components/PauseMenu';

describe('PauseMenu audio controls', () => {
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
});
