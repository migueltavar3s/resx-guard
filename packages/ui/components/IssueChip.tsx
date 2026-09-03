import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IssueRule, ValidationIssue } from '@resx-guard/core-ts';
import { t } from '../i18n';
import { ruleClass, ruleLabel, tooltipLines } from '../utils/issueMeta';

interface Props {
  rule: IssueRule;
  issues: ValidationIssue[];
  count: number;
}

const TOOLTIP_W = 280;

export function IssueChip({ rule, issues, count }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const lines = tooltipLines(issues);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const tipH = tipRef.current?.offsetHeight ?? 88;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - TOOLTIP_W - 8));
    const below = rect.bottom + 6;
    const top = below + tipH > window.innerHeight - 8 ? Math.max(8, rect.top - tipH - 6) : below;
    setPos({ top, left });
  }, [open, lines.length]);

  return (
    <span
      ref={wrapRef}
      className={`issue-chip ${ruleClass(rule)}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="issue-chip-label">{ruleLabel(rule)}</span>
      {count > 1 && <span className="issue-chip-count">{count}</span>}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            className={`issue-tooltip ${ruleClass(rule)} ${pos ? '' : 'is-measuring'}`}
            role="tooltip"
            style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
          >
            {lines.map((line, i) => (
              <div key={`${line.rule}-${line.locale ?? ''}-${i}`} className="issue-tooltip-row">
                <div className="issue-tooltip-head">
                  <span className="issue-tooltip-rule">{line.label}</span>
                  <span className="issue-tooltip-meta">
                    {t(`issue.severity.${line.severity}`)}
                    {' · '}
                    {line.localeLabel}
                  </span>
                </div>
                <div className="issue-tooltip-msg">{line.message}</div>
              </div>
            ))}
          </div>,
          document.body
        )}
    </span>
  );
}
