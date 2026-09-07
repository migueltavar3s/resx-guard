/** Autosize a textarea to its content so the grid row can grow downward. */
export function autosizeTextarea(el: HTMLTextAreaElement, minHeight = 28): number {
  const scrollTop = el.parentElement?.closest('.grid-wrap') as HTMLElement | null;
  const saved = scrollTop?.scrollTop;
  el.style.height = 'auto';
  const next = Math.max(minHeight, el.scrollHeight);
  el.style.height = `${next}px`;
  if (scrollTop && saved !== undefined) {
    scrollTop.scrollTop = saved;
  }
  return next;
}

const LINE_HEIGHT = 18;
const CELL_PAD = 10;
const MIN_ROW = 32;
const CHAR_PX = 7;

function linesForText(text: string, columnWidth: number): number {
  const inner = Math.max(48, columnWidth - 16);
  const charsPerLine = Math.max(8, Math.floor(inner / CHAR_PX));
  const parts = text.length === 0 ? [''] : text.split('\n');
  let lines = 0;
  for (const part of parts) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine));
  }
  return lines;
}

/** Estimate row height from cell texts and current column widths. */
export function estimateRowHeight(texts: string[], columnWidths: number[]): number {
  let lines = 1;
  const count = Math.max(texts.length, columnWidths.length);
  for (let i = 0; i < count; i++) {
    lines = Math.max(lines, linesForText(texts[i] ?? '', columnWidths[i] ?? 140));
  }
  return Math.max(MIN_ROW, lines * LINE_HEIGHT + CELL_PAD);
}
