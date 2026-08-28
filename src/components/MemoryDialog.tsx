import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';

import { useDialogFocus } from './ControlsOverlay';

export interface MemoryDialogProps {
  /** Deterministic Markdown produced from structured memory. Rendered as text. */
  markdown: string;
  lessonCount?: number;
  /** Reset is offered from the pairing screen only. */
  canReset?: boolean;
  onExport: () => void;
  onReset?: () => void;
  onClose: () => void;
  /** Shown while an export is being produced. */
  exporting?: boolean;
}

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^[-*]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const BOLD = /\*\*([^*]+)\*\*/;

/**
 * Agent-authored memory is untrusted text, so this deliberately understands a
 * small block grammar and renders React elements. Nothing is ever parsed as
 * HTML or injected as markup.
 */
function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];

  function flush() {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (quote.length > 0) {
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      quote = [];
    }
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  }

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = Math.min(Math.max(heading[1].length, 2), 4) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2] });
      continue;
    }

    if (RULE.test(line.trim())) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const item = LIST_ITEM.exec(line.trim());
    if (item) {
      if (paragraph.length > 0 || quote.length > 0) flush();
      list.push(item[1]);
      continue;
    }

    const quoted = QUOTE.exec(line.trim());
    if (quoted) {
      if (paragraph.length > 0 || list.length > 0) flush();
      quote.push(quoted[1]);
      continue;
    }

    if (quote.length > 0 || list.length > 0) flush();
    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];

  text.split('`').forEach((segment, segmentIndex) => {
    const key = `${keyPrefix}-${segmentIndex}`;

    if (segmentIndex % 2 === 1) {
      nodes.push(
        <code className="md__code" key={key}>
          {segment}
        </code>,
      );
      return;
    }

    segment.split(BOLD).forEach((piece, pieceIndex) => {
      if (piece.length === 0) return;
      nodes.push(
        pieceIndex % 2 === 1 ? (
          <strong key={`${key}-${pieceIndex}`}>{piece}</strong>
        ) : (
          <Fragment key={`${key}-${pieceIndex}`}>{piece}</Fragment>
        ),
      );
    });
  });

  return nodes;
}

function MarkdownBlock({ block, index }: { block: Block; index: number }) {
  const key = `b${index}`;

  switch (block.kind) {
    case 'heading': {
      const content = renderInline(block.text, key);
      if (block.level === 2) return <h3 className="md__h2">{content}</h3>;
      if (block.level === 3) return <h4 className="md__h3">{content}</h4>;
      return <h5 className="md__h4">{content}</h5>;
    }
    case 'quote':
      return (
        <blockquote className="md__quote">
          <p>{renderInline(block.text, key)}</p>
        </blockquote>
      );
    case 'list':
      return (
        <ul className="md__list">
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    case 'rule':
      return <hr className="md__rule" />;
    default:
      return <p className="md__p">{renderInline(block.text, key)}</p>;
  }
}

export function MemoryDialog({
  markdown,
  lessonCount,
  canReset = false,
  onExport,
  onReset,
  onClose,
  exporting = false,
}: MemoryDialogProps) {
  const { ref, onKeyDown } = useDialogFocus<HTMLDivElement>(onClose);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const blocks = parseMarkdown(markdown);
  const empty = lessonCount === 0 || blocks.length === 0;

  return (
    <div className="scrim scrim--memory">
      <div
        ref={ref}
        className="panel panel--memory"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="panel__head">
          <p className="panel__eyebrow">Recorded, not retrained</p>
          <h2 className="panel__title" id="memory-title">
            Partner memory
          </h2>
          <p className="panel__lede">
            Read-only in this build. Every lesson below cites an event that actually happened in a
            run.
          </p>
          {typeof lessonCount === 'number' ? (
            <p className="panel__meta">
              {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'} on this browser
            </p>
          ) : null}
        </header>

        <div className="md" tabIndex={0} role="group" aria-label="Partner memory document">
          {empty ? (
            <p className="md__empty">
              No lessons yet. They appear after a consequential event — a downed infiltrator, a
              destroyed car, a missed partner decision — and each one names the event it came from.
            </p>
          ) : null}
          {blocks.map((block, index) => (
            <MarkdownBlock block={block} index={index} key={`block-${index}`} />
          ))}
        </div>

        <footer className="panel__foot panel__foot--split">
          <div className="panel__footgroup">
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={onExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export memory'}
            </button>

            {canReset && onReset ? (
              confirmingReset ? (
                <span className="resetconfirm" role="group" aria-label="Confirm memory reset">
                  <span className="resetconfirm__text">Erase every recorded lesson?</span>
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger"
                    onClick={() => {
                      setConfirmingReset(false);
                      onReset();
                    }}
                  >
                    Confirm reset
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--quiet"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Keep memory
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="ui-btn ui-btn--quiet"
                  onClick={() => setConfirmingReset(true)}
                >
                  Reset memory
                </button>
              )
            ) : null}
          </div>

          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>
            Close
          </button>
        </footer>

        {confirmingReset ? (
          <p className="panel__hint panel__hint--warn">
            Reset clears long-term lessons only. Mission checkpoints are stored separately and stay
            where they are.
          </p>
        ) : (
          <p className="panel__hint">Export writes a readable Markdown file to your downloads.</p>
        )}
      </div>
    </div>
  );
}
