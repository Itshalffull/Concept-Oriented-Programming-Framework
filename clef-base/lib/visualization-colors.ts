const VISUALIZATION_COLOR_SLOTS = [
  'var(--visualization-slot-1)',
  'var(--visualization-slot-2)',
  'var(--visualization-slot-3)',
  'var(--visualization-slot-4)',
  'var(--visualization-slot-5)',
  'var(--visualization-slot-6)',
  'var(--visualization-slot-7)',
  'var(--visualization-slot-8)',
] as const;

const VISUALIZATION_COLOR_BY_TYPE: Record<string, string> = {
  concept: 'var(--visualization-concept)',
  schema: 'var(--visualization-schema)',
  sync: 'var(--visualization-sync)',
  suite: 'var(--visualization-suite)',
  workflow: 'var(--visualization-workflow)',
  theme: 'var(--visualization-theme)',
  view: 'var(--visualization-view)',
  widget: 'var(--visualization-widget)',
  displaymode: 'var(--visualization-display-mode)',
  automationrule: 'var(--visualization-automation-rule)',
  taxonomy: 'var(--visualization-taxonomy)',
  versionspace: 'var(--visualization-version-space)',
  versionoverride: 'var(--visualization-version-override)',
  article: 'var(--visualization-article)',
  page: 'var(--visualization-page)',
  media: 'var(--visualization-media)',
  comment: 'var(--visualization-comment)',
  file: 'var(--visualization-file)',
  default: 'var(--visualization-default)',
};

function hashVisualizationKey(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeVisualizationType(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function getLabelVisualizationColorToken(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return VISUALIZATION_COLOR_BY_TYPE.default;
  return VISUALIZATION_COLOR_SLOTS[hashVisualizationKey(normalized) % VISUALIZATION_COLOR_SLOTS.length];
}

export function getTypeVisualizationColorToken(value: string): string {
  const normalized = normalizeVisualizationType(value);
  if (!normalized) return VISUALIZATION_COLOR_BY_TYPE.default;
  return VISUALIZATION_COLOR_BY_TYPE[normalized]
    ?? VISUALIZATION_COLOR_SLOTS[hashVisualizationKey(normalized) % VISUALIZATION_COLOR_SLOTS.length];
}
