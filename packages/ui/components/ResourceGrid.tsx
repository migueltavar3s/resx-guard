import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ResourceRow } from '@resx-guard/core-ts';
import type { GridLayout } from '../hooks/usePersistedLayout';
import {
  applyColumnResize,
  columnMin,
  distributeToWidth,
  localeWidth,
} from '../hooks/usePersistedLayout';
import { t } from '../i18n';
import { ResizeHandle } from './ResizeHandle';
import { FilterSelect } from './FilterSelect';
import { IssueChip } from './IssueChip';
import {
  issuesForCell,
  namingSuggestedKey,
  primaryRule,
  ruleClass,
  uniqueRules,
} from '../utils/issueMeta';
import { autosizeTextarea, estimateRowHeight } from '../utils/rowSize';
import { usePersistedSet } from '../hooks/usePersistedSet';
import { revealFocusLocale } from '../utils/revealRow';

const NEUTRAL = '';

export type IssueFilter = 'all' | 'any' | 'warnings' | 'errors';

export interface ColumnFilters {
  key: string;
  usage: string;
  issues: IssueFilter;
  locales: Record<string, string>;
}

export function emptyColumnFilters(): ColumnFilters {
  return { key: '', usage: '', issues: 'all', locales: {} };
}

export function hasActiveColumnFilters(filters: ColumnFilters): boolean {
  if (filters.issues !== 'all') {
    return true;
  }
  if (filters.key.trim().length > 0) {
    return true;
  }
  if (filters.usage.trim().length > 0) {
    return true;
  }
  return Object.values(filters.locales).some((value) => value.trim().length > 0);
}

interface Props {
  rows: ResourceRow[];
  allLocales: string[];
  visibleLocales: string[];
  layout: GridLayout;
  onLayoutWidths: (widths: GridLayout['widths']) => void;
  filters: ColumnFilters;
  onFiltersChange: (filters: ColumnFilters) => void;
  selected: ResourceRow | null;
  onSelect: (row: ResourceRow) => void;
  onUpdateCell: (familyId: string, key: string, locale: string, value: string) => void;
  onRenameKey: (familyId: string, oldKey: string, newKey: string) => void;
  namingSuggestions?: boolean;
  familyLabel: (familyId: string) => string;
  reveal?: ResourceRow | null;
  revealNonce?: number;
}

type FlatItem =
  | { kind: 'group'; familyId: string; label: string; count: number }
  | { kind: 'row'; row: ResourceRow };

type ColumnDef =
  | { id: 'key'; kind: 'key'; width: number }
  | { id: 'usage'; kind: 'usage'; width: number }
  | { id: 'issues'; kind: 'issues'; width: number }
  | { id: string; kind: 'locale'; locale: string; width: number };

const ROW_H = 32;
const GROUP_H = 28;

function localeHeader(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function ResourceGrid({
  rows,
  visibleLocales,
  layout,
  onLayoutWidths,
  filters,
  onFiltersChange,
  selected,
  onSelect,
  familyLabel,
  onUpdateCell,
  onRenameKey,
  namingSuggestions = true,
  reveal = null,
  revealNonce = 0,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [collapsedFamilies, toggleFamilyFold] = usePersistedSet('resxGuard.groupFold.v1');
  const visible = visibleLocales.length > 0 ? visibleLocales : [NEUTRAL];

  const setParentNode = useCallback((el: HTMLDivElement | null) => {
    parentRef.current = el;
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) {
      return;
    }
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const preferred = useMemo((): ColumnDef[] => {
    const cols: ColumnDef[] = [];
    if (layout.showKey) {
      cols.push({ id: 'key', kind: 'key', width: layout.widths.key });
    }
    if (layout.showUsage) {
      cols.push({ id: 'usage', kind: 'usage', width: layout.widths.usage });
    }
    if (layout.showIssues) {
      cols.push({ id: 'issues', kind: 'issues', width: layout.widths.issues });
    }
    for (const loc of visible) {
      cols.push({
        id: `locale:${loc}`,
        kind: 'locale',
        locale: loc,
        width: localeWidth(layout, loc),
      });
    }
    return cols;
  }, [layout, visible]);

  const columns = useMemo((): ColumnDef[] => {
    if (preferred.length === 0) {
      return [];
    }
    const mins = preferred.map((col) => columnMin(col.kind));
    const minSum = mins.reduce((sum, min) => sum + min, 0);
    const available = Math.max(containerWidth, minSum);
    const displayed = distributeToWidth(
      preferred.map((col) => col.width),
      mins,
      available || minSum
    );
    return preferred.map((col, i) => ({ ...col, width: displayed[i] ?? col.width }));
  }, [preferred, containerWidth]);

  const persistWidths = useCallback(
    (next: ColumnDef[]) => {
      const locales: Record<string, number> = { ...layout.widths.locales };
      let key = layout.widths.key;
      let usage = layout.widths.usage;
      let issues = layout.widths.issues;
      for (const col of next) {
        if (col.kind === 'key') {
          key = col.width;
        } else if (col.kind === 'usage') {
          usage = col.width;
        } else if (col.kind === 'issues') {
          issues = col.width;
        } else {
          locales[col.locale] = col.width;
        }
      }
      onLayoutWidths({ key, usage, issues, locales });
    },
    [layout.widths, onLayoutWidths]
  );

  const resizeColumn = useCallback(
    (columnId: string, delta: number) => {
      const index = columns.findIndex((c) => c.id === columnId);
      if (index < 0) {
        return;
      }
      const mins = columns.map((col) => columnMin(col.kind));
      const minSum = mins.reduce((sum, min) => sum + min, 0);
      const available = Math.max(containerWidth, minSum);
      const displayed = applyColumnResize(
        columns.map((col) => col.width),
        mins,
        index,
        delta,
        available
      );
      persistWidths(columns.map((col, i) => ({ ...col, width: displayed[i] ?? col.width })));
    },
    [columns, containerWidth, persistWidths]
  );

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
      if (!collapsedFamilies.has(row.familyId)) {
        items.push({ kind: 'row', row });
      }
    }
    flush();
    return items;
  }, [rows, familyLabel, collapsedFamilies]);

  const rowWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const gridCols = columns.map((c) => `${c.width}px`).join(' ');
  const colWidths = columns.map((c) => c.width);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const item = flat[i];
      if (!item || item.kind === 'group') {
        return GROUP_H;
      }
      const texts = columns.map((col) => {
        if (col.kind === 'key') {
          return item.row.key;
        }
        if (col.kind === 'usage') {
          return String(item.row.usageCount ?? 0);
        }
        if (col.kind === 'issues') {
          return item.row.issues.map((issue) => issue.rule).join(' ');
        }
        return item.row.values[col.locale] ?? '';
      });
      return estimateRowHeight(texts, colWidths);
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 12,
    getItemKey: (i) => {
      const item = flat[i];
      if (!item) {
        return i;
      }
      return item.kind === 'group' ? `g:${item.familyId}` : `r:${item.row.familyId}:${item.row.key}`;
    },
  });

  const bindRow = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      if (!el) {
        return;
      }
      el.setAttribute('data-index', String(index));
      virtualizer.measureElement(el);
    },
    [virtualizer]
  );

  useLayoutEffect(() => {
    if (!reveal || revealNonce === 0) {
      return;
    }
    if (collapsedFamilies.has(reveal.familyId)) {
      toggleFamilyFold(reveal.familyId);
      return;
    }
    const index = flat.findIndex(
      (item) => item.kind === 'row' && item.row.familyId === reveal.familyId && item.row.key === reveal.key
    );
    if (index < 0) {
      return;
    }
    virtualizer.scrollToIndex(index, { align: 'center' });
  }, [reveal, revealNonce, flat, collapsedFamilies, toggleFamilyFold, virtualizer]);

  const setKeyFilter = (key: string) => onFiltersChange({ ...filters, key });
  const setUsageFilter = (usage: string) => onFiltersChange({ ...filters, usage });
  const setIssueFilter = (issues: IssueFilter) => onFiltersChange({ ...filters, issues });
  const setLocaleFilter = (locale: string, value: string) =>
    onFiltersChange({
      ...filters,
      locales: { ...filters.locales, [locale]: value },
    });

  if (columns.length === 0) {
    return <div className="empty">{t('columns.noneVisible')}</div>;
  }

  const filtersActive = hasActiveColumnFilters(filters);
  const emptyMessage = filtersActive ? t('empty.grid.filtered') : t('empty.grid');

  const renderHeaderCell = (col: ColumnDef, rowKind: 'title' | 'filter') => {
    if (col.kind === 'key') {
      return rowKind === 'title' ? (
        t('column.key')
      ) : (
        <input
          className="col-filter"
          type="search"
          placeholder={t('filter.column')}
          value={filters.key}
          onChange={(e) => setKeyFilter(e.target.value)}
        />
      );
    }
    if (col.kind === 'usage') {
      return rowKind === 'title' ? (
        <span title={t('column.usage.hint')}>{t('column.usage')}</span>
      ) : (
        <input
          className="col-filter"
          type="search"
          placeholder={t('filter.column')}
          value={filters.usage}
          onChange={(e) => setUsageFilter(e.target.value)}
        />
      );
    }
    if (col.kind === 'issues') {
      return rowKind === 'title' ? (
        <span title={t('column.issues.hint')}>{t('column.issues')}</span>
      ) : (
        <FilterSelect
          value={filters.issues}
          onChange={setIssueFilter}
          options={[
            { value: 'all', label: t('filter.issues.all') },
            { value: 'any', label: t('filter.issues.any') },
            { value: 'warnings', label: t('filter.issues.warnings') },
            { value: 'errors', label: t('filter.issues.errors') },
          ]}
        />
      );
    }
    return rowKind === 'title' ? (
      localeHeader(col.locale)
    ) : (
      <input
        className="col-filter"
        type="search"
        placeholder={t('filter.column')}
        value={filters.locales[col.locale] ?? ''}
        onChange={(e) => setLocaleFilter(col.locale, e.target.value)}
      />
    );
  };

  return (
    <div className="grid-wrap" ref={setParentNode} tabIndex={0}>
      <div className="grid-inner" style={{ width: rowWidth }}>
        <div className="grid-header-block" style={{ width: rowWidth }}>
          {(['title', 'filter'] as const).map((rowKind) => (
            <div
              key={rowKind}
              className={`grid-header-row grid-header-${rowKind === 'title' ? 'titles' : 'filters'}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {columns.map((col) => (
                <div key={`${rowKind}-${col.id}`} className="grid-th grid-th-resizable">
                  {renderHeaderCell(col, rowKind)}
                  {rowKind === 'title' && (
                    <ResizeHandle onResize={(d) => resizeColumn(col.id, d)} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="grid-empty">
            <div className="empty">{emptyMessage}</div>
            {filtersActive ? (
              <button
                type="button"
                className="btn"
                onClick={() => onFiltersChange(emptyColumnFilters())}
              >
                {t('filter.clear')}
              </button>
            ) : null}
          </div>
        ) : (
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
              transform: `translateY(${vItem.start}px)`,
            };

            if (item.kind === 'group') {
              const folded = collapsedFamilies.has(item.familyId);
              return (
                <div
                  key={`g-${item.familyId}`}
                  ref={bindRow(vItem.index)}
                  data-index={vItem.index}
                  className={`grid-group${folded ? ' collapsed' : ''}`}
                  style={{ ...style, height: GROUP_H }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!folded}
                  aria-label={
                    folded
                      ? t('tree.expand', item.label)
                      : t('tree.collapse', item.label)
                  }
                  onClick={() => toggleFamilyFold(item.familyId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFamilyFold(item.familyId);
                    }
                  }}
                >
                  <span className={`tree-twistie${folded ? ' collapsed' : ''}`} aria-hidden />
                  <span className="grid-group-label">{item.label}</span>
                  <span className="grid-group-count">{item.count}</span>
                </div>
              );
            }

            const { row } = item;
            const isSelected =
              selected?.familyId === row.familyId && selected?.key === row.key;

            return (
              <GridDataRow
                key={`${row.familyId}:${row.key}`}
                index={vItem.index}
                virtualizer={virtualizer}
                row={row}
                isSelected={isSelected}
                style={style}
                gridCols={gridCols}
                columns={columns}
                colWidths={colWidths}
                namingSuggestions={namingSuggestions}
                onSelect={onSelect}
                onUpdateCell={onUpdateCell}
                onRenameKey={onRenameKey}
                focusLocale={
                  reveal && reveal.familyId === row.familyId && reveal.key === row.key
                    ? revealFocusLocale(row, visible)
                    : undefined
                }
                focusNonce={
                  reveal && reveal.familyId === row.familyId && reveal.key === row.key
                    ? revealNonce
                    : 0
                }
              />
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}

function GridDataRow({
  index,
  virtualizer,
  row,
  isSelected,
  style,
  gridCols,
  columns,
  colWidths,
  namingSuggestions,
  onSelect,
  onUpdateCell,
  onRenameKey,
  focusLocale,
  focusNonce,
}: {
  index: number;
  virtualizer: { measureElement: (el: Element | null) => void };
  row: ResourceRow;
  isSelected: boolean;
  style: CSSProperties;
  gridCols: string;
  columns: ColumnDef[];
  colWidths: number[];
  namingSuggestions: boolean;
  onSelect: (row: ResourceRow) => void;
  onUpdateCell: (familyId: string, key: string, locale: string, value: string) => void;
  onRenameKey: (familyId: string, oldKey: string, newKey: string) => void;
  focusLocale?: string;
  focusNonce: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    virtualizer.measureElement(el);
    const observer = new ResizeObserver(() => virtualizer.measureElement(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, virtualizer, row.key, row.values, row.issues, colWidths]);

  return (
    <div
      ref={ref}
      data-index={index}
      className={`grid-row ${isSelected ? 'row-selected' : ''}`}
      data-row-id={`${row.familyId}:${row.key}`}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: gridCols,
      }}
      onMouseDown={() => onSelect(row)}
      onClick={() => onSelect(row)}
    >
      {columns.map((col) => {
        if (col.kind === 'key') {
          return (
            <div key={col.id} className="grid-cell key">
              <EditableText
                value={row.key}
                columnWidth={col.width}
                onActivate={() => onSelect(row)}
                onCommit={(newKey) => {
                  if (newKey && newKey !== row.key) {
                    onRenameKey(row.familyId, row.key, newKey);
                  }
                }}
              />
            </div>
          );
        }
        if (col.kind === 'usage') {
          const count = row.usageCount ?? 0;
          return (
            <div key={col.id} className={`grid-cell usage${count === 0 ? ' usage-zero' : ''}`}>
              <span className="usage-count">{count}</span>
            </div>
          );
        }
        if (col.kind === 'issues') {
          return (
            <div key={col.id} className="grid-cell issues">
              <IssueIndicators
                row={row}
                namingSuggestions={namingSuggestions}
                onApplyNaming={(suggestedKey) =>
                  onRenameKey(row.familyId, row.key, suggestedKey)
                }
              />
            </div>
          );
        }
        return (
          <div
            key={col.id}
            className={`grid-cell${issueCellClass(row, col.locale)}`}
          >
            <EditableText
              value={row.values[col.locale] ?? ''}
              columnWidth={col.width}
              focusNonce={focusLocale === col.locale ? focusNonce : 0}
              onActivate={() => onSelect(row)}
              onCommit={(value) => {
                if (value !== (row.values[col.locale] ?? '')) {
                  onUpdateCell(row.familyId, row.key, col.locale, value);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function issueCellClass(row: ResourceRow, locale?: string): string {
  const rule = primaryRule(issuesForCell(row.issues, locale));
  return rule ? ` has-issue ${ruleClass(rule)}` : '';
}

export function IssueIndicators({
  row,
  namingSuggestions,
  onApplyNaming,
}: {
  row: ResourceRow;
  namingSuggestions: boolean;
  onApplyNaming: (suggestedKey: string) => void;
}) {
  if (row.issues.length === 0) {
    return <span className="issue-empty" aria-hidden>—</span>;
  }
  const rules = uniqueRules(row.issues);
  const suggestedKey = namingSuggestions ? namingSuggestedKey(row.issues) : undefined;
  return (
    <div className="issue-chips">
      {rules.map((rule) => {
        const ofRule = row.issues.filter((i) => i.rule === rule);
        return <IssueChip key={rule} rule={rule} issues={ofRule} count={ofRule.length} />;
      })}
      {suggestedKey ? (
        <button
          type="button"
          className="issue-apply-chip"
          title={t('issue.naming.apply', suggestedKey)}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onApplyNaming(suggestedKey);
          }}
        >
          {t('issue.naming.applyShort')}
        </button>
      ) : null}
    </div>
  );
}

function EditableText({
  value,
  onCommit,
  onActivate,
  columnWidth,
  focusNonce = 0,
}: {
  value: string;
  onCommit: (v: string) => void;
  onActivate?: () => void;
  columnWidth?: number;
  focusNonce?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const skipCommit = useRef(false);
  const pending = useRef<string | null>(null);
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const display = focused || pending.current !== null ? draft : value;

  useEffect(() => {
    if (pending.current !== null) {
      if (value === pending.current) {
        pending.current = null;
        setDraft(value);
      }
      return;
    }
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  useLayoutEffect(() => {
    if (ref.current) {
      autosizeTextarea(ref.current, ROW_H);
    }
  }, [display, columnWidth]);

  useLayoutEffect(() => {
    if (focusNonce > 0) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focusNonce]);

  return (
    <textarea
      ref={ref}
      className="cell-textarea"
      rows={1}
      value={display}
      onFocus={() => {
        setFocused(true);
        setDraft(pending.current ?? value);
        onActivate?.();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        autosizeTextarea(e.target, ROW_H);
      }}
      onBlur={(e) => {
        setFocused(false);
        if (skipCommit.current) {
          skipCommit.current = false;
          pending.current = null;
          setDraft(value);
          return;
        }
        const next = e.currentTarget.value;
        if (next === value) {
          pending.current = null;
          return;
        }
        pending.current = next;
        setDraft(next);
        onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Delete') {
          return;
        }
        e.stopPropagation();
        if (e.key === 'Escape') {
          skipCommit.current = true;
          pending.current = null;
          setDraft(value);
          e.currentTarget.blur();
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
