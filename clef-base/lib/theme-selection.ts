export interface ThemeRecord {
  [key: string]: unknown;
  _key?: string;
  id?: string;
  theme?: string;
  name?: string;
  active?: boolean;
  status?: string;
  priority?: number | string;
  base?: string;
  extends?: string;
}

export function getThemeId(theme: ThemeRecord): string {
  return String(theme._key ?? theme.id ?? theme.theme ?? theme.name ?? '').trim();
}

export function isThemeActive(theme: ThemeRecord): boolean {
  return theme.active === true || theme.status === 'active';
}

function byPriority(left: ThemeRecord, right: ThemeRecord): number {
  const priorityDiff = Number(right.priority ?? 0) - Number(left.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return getThemeId(left).localeCompare(getThemeId(right));
}

export function pickActiveTheme(themes: ThemeRecord[], defaultTheme = 'light'): string {
  const active = [...themes]
    .filter((theme) => isThemeActive(theme) && getThemeId(theme))
    .sort(byPriority)[0];

  if (active) {
    return getThemeId(active);
  }

  const fallback = themes.find((theme) => getThemeId(theme) === defaultTheme)
    ?? themes.find((theme) => getThemeId(theme));

  return fallback ? getThemeId(fallback) : defaultTheme;
}

export function applyDocumentTheme(themeId: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = themeId;
}
