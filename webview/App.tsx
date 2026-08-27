import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ExtensionSettings,
  IndexSnapshot,
  ResourceRow,
  TreeNode,
} from '../src/models/types';
import { setLanguage, t } from './i18n';
import { onHostMessage, post } from './vscodeApi';
import { FileTree } from './components/FileTree';
import { ResourceGrid, type ColumnFilters, type IssueFilter } from './components/ResourceGrid';
import { SettingsPage } from './components/SettingsPage';
import { AddEntryModal } from './components/AddEntryModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ColumnPicker } from './components/ColumnPicker';
import { SummaryPanel } from './components/SummaryPanel';
import { ResizeHandle } from './components/ResizeHandle';
import { usePersistedLayout, PANEL_LIMITS, clampPanelWidth } from './hooks/usePersistedLayout';

type Tab = 'main' | 'settings';

function normalize(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const defaultFilters = (): ColumnFilters => ({
  key: '',
  issues: 'all',
  locales: {},
});

export function App() {
  const [snapshot, setSnapshot] = useState<IndexSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('main');
  const [filters, setFilters] = useState<ColumnFilters>(defaultFilters);
  const [selected, setSelected] = useState<ResourceRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [layout, patchLayout] = usePersistedLayout();

  useEffect(() => {
    const dispose = onHostMessage((msg) => {
      if (msg.type === 'snapshot') {
        setLanguage(msg.payload.language);
        setSnapshot(msg.payload);
        setSelected((prev) => {
          if (!prev) {
            return null;
          }
          return (
            msg.payload.rows.find(
              (r) => r.familyId === prev.familyId && r.key === prev.key
            ) ?? null
          );
        });
      }
    });
    post({ type: 'ready' });
    return dispose;
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selected) {
      return;
    }
    post({
      type: 'deleteEntry',
      familyId: selected.familyId,
      key: selected.key,
    });
    setSelected(null);
    setPendingDelete(false);
  }, [selected]);

  const requestDelete = useCallback(() => {
    if (!selected) {
      return;
    }
    setPendingDelete(true);
  }, [selected]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || !selected || pendingDelete || e.shiftKey) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (active && shouldIgnoreRowDelete(active)) {
        return;
      }
      e.preventDefault();
      requestDelete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, pendingDelete, requestDelete]);

  const familyLabel = useCallback(
    (familyId: string) => {
      return snapshot?.families.find((f) => f.id === familyId)?.displayName ?? familyId;
    },
    [snapshot]
  );

  const matchesIssueFilter = (row: ResourceRow, issueFilter: IssueFilter): boolean => {
    if (issueFilter === 'all') {
      return true;
    }
    if (row.issues.length === 0) {
      return false;
    }
    if (issueFilter === 'any') {
      return true;
    }
    if (issueFilter === 'errors') {
      return row.issues.some((i) => i.severity === 'error');
    }
    return row.issues.some((i) => i.severity !== 'error');
  };

  const filteredRows = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    const keyQ = normalize(filters.key.trim());

    return snapshot.rows.filter((row) => {
      if (!matchesIssueFilter(row, filters.issues)) {
        return false;
      }
      if (keyQ && !normalize(row.key).includes(keyQ)) {
        return false;
      }
      for (const [locale, text] of Object.entries(filters.locales)) {
        const q = normalize(text.trim());
        if (q && !normalize(row.values[locale] ?? '').includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [snapshot, filters]);

  const visibleLocales = snapshot?.visibleLocales ?? [];
  const allLocales = snapshot?.locales ?? [];

  const onToggleFamily = (familyId: string, checked: boolean) => {
    if (!snapshot) {
      return;
    }
    const set = new Set(snapshot.selectedFamilyIds);
    if (checked) {
      set.add(familyId);
    } else {
      set.delete(familyId);
    }
    post({ type: 'setSelectedFamilies', familyIds: [...set] });
  };

  const onToggleTree = (node: TreeNode, checked: boolean) => {
    if (!snapshot) {
      return;
    }
    const ids = collectFamilyIds(node);
    const set = new Set(snapshot.selectedFamilyIds);
    for (const id of ids) {
      if (checked) {
        set.add(id);
      } else {
        set.delete(id);
      }
    }
    post({ type: 'setSelectedFamilies', familyIds: [...set] });
  };

  const updateSettings = (partial: Partial<ExtensionSettings>) => {
    post({ type: 'updateSettings', settings: partial });
  };

  const toggleLocaleColumn = (locale: string, visible: boolean) => {
    if (!snapshot) {
      return;
    }
    const set = new Set(visibleLocales);
    if (visible) {
      set.add(locale);
    } else {
      const remainingLocales = allLocales.filter((l) => l !== locale && set.has(l));
      const wouldHideAllData =
        !layout.showKey && !layout.showIssues && remainingLocales.length === 0;
      if (wouldHideAllData) {
        return;
      }
      set.delete(locale);
    }
    const ordered = allLocales.filter((l) => set.has(l));
    post({ type: 'setVisibleLocales', locales: ordered });
  };

  const resizeSidebar = useCallback((delta: number) => {
    patchLayout((prev) => ({
      sidebarWidth: clampPanelWidth(
        prev.sidebarWidth + delta,
        PANEL_LIMITS.sidebar.min,
        PANEL_LIMITS.sidebar.max
      ),
    }));
  }, [patchLayout]);

  const resizeSummary = useCallback((delta: number) => {
    patchLayout((prev) => ({
      summaryWidth: clampPanelWidth(
        prev.summaryWidth - delta,
        PANEL_LIMITS.summary.min,
        PANEL_LIMITS.summary.max
      ),
    }));
  }, [patchLayout]);

  if (!snapshot) {
    return <div className="loading">{t('loading')}</div>;
  }

  return (
    <div className="app">
      <nav className="tabs">
        {(['main', 'settings'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`tab.${id}`)}
          </button>
        ))}
      </nav>

      {tab === 'main' && (
        <div className="main-layout">
          <aside
            className="sidebar"
            style={{ width: layout.sidebarWidth, flex: `0 0 ${layout.sidebarWidth}px` }}
          >
            <div className="section-title">{t('files.title')}</div>
            {snapshot.tree.length === 0 ? (
              <div className="empty">{t('files.empty')}</div>
            ) : (
              <FileTree
                nodes={snapshot.tree}
                onToggleFamily={onToggleFamily}
                onToggleNode={onToggleTree}
              />
            )}
          </aside>
          <ResizeHandle variant="pane" onResize={resizeSidebar} />

          <section className="center">
            <div className="toolbar">
              <button
                type="button"
                className="btn primary"
                disabled={snapshot.selectedFamilyIds.length === 0}
                onClick={() => setShowAdd(true)}
              >
                <span className="btn-icon" aria-hidden>
                  +
                </span>
                {t('toolbar.add')}
              </button>
              <button
                type="button"
                className="btn danger-ghost"
                disabled={!selected}
                onClick={requestDelete}
              >
                <span className="btn-icon" aria-hidden>
                  ⌫
                </span>
                {t('toolbar.delete')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={snapshot.selectedFamilyIds.length === 0}
                onClick={() => post({ type: 'exportExcel' })}
              >
                <span className="btn-icon" aria-hidden>
                  ⇧
                </span>
                {t('toolbar.export')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => post({ type: 'importExcel' })}
              >
                <span className="btn-icon" aria-hidden>
                  ⇩
                </span>
                {t('toolbar.import')}
              </button>
              <div className="toolbar-spacer" />
              <div className="toolbar-picker-wrap">
                <button
                  type="button"
                  className={`btn ${columnPickerOpen ? 'active' : ''}`}
                  onClick={() => setColumnPickerOpen((v) => !v)}
                >
                  <span className="btn-icon" aria-hidden>
                    ▦
                  </span>
                  {t('toolbar.columns')}
                </button>
                <ColumnPicker
                  open={columnPickerOpen}
                  onClose={() => setColumnPickerOpen(false)}
                  showKey={layout.showKey}
                  showIssues={layout.showIssues}
                  allLocales={allLocales}
                  visibleLocales={visibleLocales}
                  onToggleKey={(v) => {
                    if (!v && !layout.showIssues && visibleLocales.length === 0) {
                      return;
                    }
                    patchLayout({ showKey: v });
                  }}
                  onToggleIssues={(v) => {
                    if (!v && !layout.showKey && visibleLocales.length === 0) {
                      return;
                    }
                    patchLayout({ showIssues: v });
                  }}
                  onToggleLocale={toggleLocaleColumn}
                />
              </div>
              <button
                type="button"
                className={`btn ${layout.summaryOpen ? 'active' : ''}`}
                onClick={() => patchLayout({ summaryOpen: !layout.summaryOpen })}
                title={layout.summaryOpen ? t('summary.hide') : t('summary.show')}
              >
                <span className="btn-icon" aria-hidden>
                  ⓘ
                </span>
                {layout.summaryOpen ? t('summary.hide') : t('summary.show')}
              </button>
            </div>

            <div className="workspace">
              <div className="grid-area">
                <ResourceGrid
                  rows={filteredRows}
                  allLocales={allLocales}
                  visibleLocales={visibleLocales}
                  layout={layout}
                  onLayoutWidths={(widths) => patchLayout({ widths })}
                  filters={filters}
                  onFiltersChange={setFilters}
                  selected={selected}
                  onSelect={setSelected}
                  familyLabel={familyLabel}
                  onUpdateCell={(familyId, key, locale, value) =>
                    post({ type: 'updateCell', familyId, key, locale, value })
                  }
                  onRenameKey={(familyId, oldKey, newKey) =>
                    post({ type: 'renameKey', familyId, oldKey, newKey })
                  }
                />
              </div>

              {layout.summaryOpen && (
                <>
                  <ResizeHandle variant="pane" onResize={resizeSummary} />
                  <aside
                    className="summary-panel"
                    style={{
                      width: layout.summaryWidth,
                      flex: `0 0 ${layout.summaryWidth}px`,
                    }}
                  >
                    <div className="summary-panel-header">
                      <span>{t('summary.title')}</span>
                      <div className="summary-panel-actions">
                        {selected && (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={requestDelete}
                            title={t('toolbar.delete')}
                          >
                            ⌫
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => patchLayout({ summaryOpen: false })}
                          title={t('summary.hide')}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <SummaryPanel row={selected} locales={allLocales} />
                  </aside>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'settings' && (
        <div className="page">
          <SettingsPage settings={snapshot.settings} onChange={updateSettings} />
        </div>
      )}

      {pendingDelete && selected && (
        <ConfirmDialog
          title={t('delete.title')}
          message={t('delete.message', selected.key)}
          confirmLabel={t('delete.confirm')}
          cancelLabel={t('delete.cancel')}
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(false)}
        />
      )}

      {showAdd && (
        <AddEntryModal
          families={snapshot.families.filter((f) =>
            snapshot.selectedFamilyIds.includes(f.id)
          )}
          rows={snapshot.rows}
          keyNaming={snapshot.settings.keyNaming}
          onCancel={() => setShowAdd(false)}
          onConfirm={(familyId, key, neutralValue) => {
            post({ type: 'addEntry', familyId, key, neutralValue });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function shouldIgnoreRowDelete(active: HTMLElement): boolean {
  if (active.closest('.modal')) {
    return true;
  }
  if (active.closest('.page')) {
    return true;
  }
  if (active.closest('.col-filter') || active.closest('.filter-select')) {
    return true;
  }
  if (active.closest('.column-picker')) {
    return true;
  }
  return false;
}

function collectFamilyIds(node: TreeNode): string[] {
  if (node.kind === 'family' && node.familyId) {
    return [node.familyId];
  }
  return (node.children ?? []).flatMap(collectFamilyIds);
}
