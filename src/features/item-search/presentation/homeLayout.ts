import { usesLargeItemTypography } from './itemTheme';

export type ItemHomeSnapshot = {
  expanded: boolean;
  collapsedCount: number;
  scrollOffset: number;
  collapsedScrollOffset: number;
  guidePage: number;
};

export function isHomeSnapshot(value: unknown): value is ItemHomeSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return typeof state.expanded === 'boolean'
    && [state.collapsedCount, state.guidePage].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    && (state.collapsedCount as number) <= 24 && (state.guidePage as number) <= 3
    && [state.scrollOffset, state.collapsedScrollOffset].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function homeGridMetrics(width: number, fontScale: number) {
  const large = usesLargeItemTypography(fontScale);
  const cell = large ? width < 300 ? 128 : width >= 352 ? 112 : 96
    : width >= 360 ? 90 : width >= 352 ? 88 : width >= 336 ? 84 : 80;
  const max = large ? width < 300 ? 2 : width >= 450 ? 6 : 3 : width >= 560 ? 6 : width >= 450 ? 5 : 4;
  const columns = Math.max(1, Math.min(max, Math.floor(width / cell)));
  const tile = large || width < 300 ? 72 : width >= 336 ? 64 : 56;
  const compact = !large && width >= 300 && width < 336;
  return { columns, tile, icon: tile / 2, gap: large ? 24 : 16, rowHeight: tile + (large ? 64 : 48),
    labelSize: compact ? 14 : 16, labelHeight: compact ? 20 : 24 };
}

export function homeCollapsedCount(columns: number, available: number, rowHeight: number, gap: number) {
  const rows = available > 0 ? Math.max(1, Math.floor((available + gap) / (rowHeight + gap))) : Math.ceil(8 / columns);
  const measured = rows * columns;
  return measured < 19 ? measured : Math.ceil(8 / columns) * columns;
}
