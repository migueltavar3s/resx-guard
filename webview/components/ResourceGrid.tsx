import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ResourceRow } from '../../src/models/types';
import { t } from '../i18n';

const NEUTRAL = '';

interface Props {
  rows: ResourceRow[];
  visibleLocales: string[];
  selected: ResourceRow | null;
  onSelect: (row: ResourceRow) => void;
  familyLabel: (familyId: string) => string;
  onUpdateCell: (familyId: string, key: string, locale: string, value: string) => void;
  onRenameKey: (familyId: string, oldKey: string, newKey: string) => void;
}

type FlatItem =
  | { kind: 'group'; familyId: string; label: string; count: number }
  | { kind: 'row'; row: ResourceRow };

function localeHeader(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function ResourceGrid({
  rows,
  visibleLocales,
  selected,
  onSelect,
  familyLabel,
  onUpdateCell,
  onRenameKey,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => {
    const items: FlatItem[] = [];
    let currentFamily = '';
    let groupCount = 0;
    let groupStart = -1;

    const flush = () => {
      if (groupStart >= 0) {
        items[groupStart] = {
          ...(items[groupStart] as Extract<FlatItem, { kind: 'group' }>),
          count: groupCount,
        };
      }
    };

    for (const row of rows) {
      if (row.familyId !== currentFamily) {
        flush();
        currentFamily = row.familyId;
        groupCount = 0;
        groupStart = items.length;
        items.push({
          kind: 'group',
          familyId: row.familyId,
          label: familyLabel(row.familyId),
          count: 0,
        });
      }
      groupCount++;
      items.push({ kind: 'row', row });
    }
    flush();
    return items;
  }, [rows, familyLabel]);

  const locales = visibleLocales.length > 0 ? visibleLocales : [NEUTRAL];

  const keyWidth = 200;
  const issueWidth = 36;
  const colWidth = 220;
  const rowWidth = keyWidth + issueWidth + locales.length * colWidth;

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (flat[i]?.kind === 'group' ? 34 : 42),
    overscan: 20,
  });

  if (rows.length === 0) {
    return <div className="empty">{t('empty.grid')}</div>;
  }

  return (
    <div className="grid-wrap" ref={parentRef}>
      <div style={{ minWidth: rowWidth }}>
        <div
          className="grid-header"
          style={{
            display: 'grid',
            gridTemplateColumns: `${keyWidth}px ${issueWidth}px repeat(${locales.length}, ${colWidth}px)`,
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: 'var(--vscode-editor-background)',
            borderBottom: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))',
          }}
        >
          <div className="grid-th">{t('column.key')}</div>
          <div className="grid-th">!</div>
          {locales.map((loc) => (
            <div key={loc || 'neutral'} className="grid-th">
              {localeHeader(loc)}
            </div>
          ))}
        </div>

        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: rowWidth,
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const item = flat[vItem.index];
            if (!item) {
              return null;
            }

            const style: CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: vItem.size,
              transform: `translateY(${vItem.start}px)`,
            };

            if (item.kind === 'group') {
              return (
                <div key={`g-${item.familyId}`} className="grid-group" style={style}>
                  {item.label} · {t('group.entries', String(item.count))}
                </div>
              );
            }

            const { row } = item;
            const isSelected =
              selected?.familyId === row.familyId && selected?.key === row.key;
            const hasError = row.issues.some((i) => i.severity === 'error');
            const hasWarn = row.issues.length > 0;

            return (
              <div
                key={`${row.familyId}:${row.key}`}
                className={`grid-row ${isSelected ? 'row-selected' : ''}`}
                style={{
                  ...style,
                  display: 'grid',
                  gridTemplateColumns: `${keyWidth}px ${issueWidth}px repeat(${locales.length}, ${colWidth}px)`,
                }}
                onClick={() => onSelect(row)}
              >
                <div className="grid-cell key">
                  <EditableText
                    value={row.key}
                    onCommit={(newKey) => {
                      if (newKey && newKey !== row.key) {
                        onRenameKey(row.familyId, row.key, newKey);
                      }
                    }}
                  />
                </div>
                <div className="grid-cell issues">
                  {hasWarn && (
                    <span
                      className={`issue-badge ${hasError ? 'error' : ''}`}
                      title={row.issues.map((i) => i.message).join('\n')}
                    >
                      {hasError ? '✕' : '!'}
                    </span>
                  )}
                </div>
                {locales.map((loc) => {
                  const localeIssues = row.issues.filter((i) => i.locale === loc);
                  return (
                    <div
                      key={loc || 'neutral'}
                      className={`grid-cell ${localeIssues.length ? 'has-issue' : ''}`}
                    >
                      <EditableText
                        value={row.values[loc] ?? ''}
                        multiline
                        onCommit={(value) =>
                          onUpdateCell(row.familyId, row.key, loc, value)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditableText({
  value,
  onCommit,
  multiline,
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  const display = focused ? draft : value;
  const useTextarea = multiline && (display.includes('\n') || display.length > 70 || focused);

  if (useTextarea) {
    return (
      <textarea
        className="cell-textarea"
        rows={Math.min(5, Math.max(2, display.split('\n').length))}
        value={display}
        onFocus={() => {
          setFocused(true);
          setDraft(value);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          onCommit(draft);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <input
      className="cell-input"
      value={display}
      onFocus={() => {
        setFocused(true);
        setDraft(value);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onCommit(multiline ? draft : draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
