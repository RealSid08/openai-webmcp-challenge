import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus containment for the full-window mission dialogs. Moves focus into the
 * dialog on mount, keeps Tab inside it, restores the previous element on close,
 * and routes Escape to the dialog's own dismiss action.
 */
export function useDialogFocus<T extends HTMLElement>(onDismiss?: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;
    (node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus();

    return () => previous?.focus();
  }, []);

  function onKeyDown(event: ReactKeyboardEvent<T>) {
    if (event.key === 'Escape' && onDismiss) {
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== 'Tab') return;

    const node = ref.current;
    if (!node) return;

    const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === node)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { ref, onKeyDown };
}

export interface ControlBinding {
  keys: string;
  action: string;
  note?: string;
}

export interface ControlGroup {
  title: string;
  bindings: readonly ControlBinding[];
}

export interface ControlsOverlayProps {
  /**
   * `FIRST_RUN` is the in-cover overview that holds combat pressure back.
   * `REFERENCE` is the complete list opened from the pause menu.
   */
  variant?: 'FIRST_RUN' | 'REFERENCE';
  groups?: readonly ControlGroup[];
  onDismiss: () => void;
  dismissLabel?: string;
}

export const DEFAULT_CONTROL_GROUPS: readonly ControlGroup[] = [
  {
    title: 'On foot',
    bindings: [
      { keys: 'W A S D', action: 'Move' },
      { keys: 'Shift', action: 'Sprint' },
      { keys: 'Ctrl', action: 'Crouch behind cover' },
      { keys: 'Mouse', action: 'Look' },
    ],
  },
  {
    title: 'Weapon',
    bindings: [
      { keys: 'Right mouse', action: 'Aim' },
      { keys: 'Left mouse', action: 'Fire' },
      { keys: 'R', action: 'Reload', note: 'Reserve rounds only' },
      { keys: 'E', action: 'Interact, plant, detonate', note: 'When the prompt is shown' },
    ],
  },
  {
    title: 'The partner',
    bindings: [
      { keys: 'Q', action: 'Switch bodies', note: 'Your partner inherits the one you leave' },
      { keys: '1 – 4', action: 'Quick callouts', note: 'Cover me, hold, move, focus target' },
      { keys: 'Voice or text', action: 'Talk to your partner through ChatGPT or Codex' },
    ],
  },
  {
    title: 'Mission',
    bindings: [
      { keys: 'Esc', action: 'Pause' },
      { keys: 'M', action: 'Partner memory' },
    ],
  },
];

export function ControlsOverlay({
  variant = 'REFERENCE',
  groups = DEFAULT_CONTROL_GROUPS,
  onDismiss,
  dismissLabel,
}: ControlsOverlayProps) {
  const { ref, onKeyDown } = useDialogFocus<HTMLDivElement>(onDismiss);
  const firstRun = variant === 'FIRST_RUN';

  return (
    <div className="scrim scrim--controls">
      <div
        ref={ref}
        className="panel panel--controls"
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-title"
        aria-describedby="controls-lede"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="panel__head">
          <p className="panel__eyebrow">{firstRun ? 'Behind cover' : 'Reference'}</p>
          <h2 className="panel__title" id="controls-title">
            Controls
          </h2>
          <p className="panel__lede" id="controls-lede">
            {firstRun
              ? 'Owen and Cody are still protected. The floor goes live the moment you close this or move.'
              : 'The full control list stays available here on every attempt.'}
          </p>
        </header>

        <div className="ctrlgrid">
          {groups.map((group) => (
            <section className="ctrlgroup" key={group.title}>
              <h3 className="ctrlgroup__title">{group.title}</h3>
              <dl className="ctrlgroup__list">
                {group.bindings.map((binding) => (
                  <div className="binding" key={`${group.title}-${binding.action}`}>
                    <dt className="binding__keys">{binding.keys}</dt>
                    <dd className="binding__action">
                      {binding.action}
                      {binding.note ? <span className="binding__note">{binding.note}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <footer className="panel__foot">
          <button type="button" className="ui-btn ui-btn--primary" onClick={onDismiss}>
            {dismissLabel ?? (firstRun ? 'Start the fight' : 'Back')}
          </button>
          <p className="panel__hint">Esc closes this</p>
        </footer>
      </div>
    </div>
  );
}
