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
  overrides?: string;
}

export interface ThemeDocumentState {
  id: string;
  mode: string | null;
  density: string | null;
  motif: string | null;
  styleProfile: string | null;
  sourceType: string | null;
  cssVariables: Record<string, string>;
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

export function pickActiveThemeRecord(themes: ThemeRecord[], defaultTheme = 'light'): ThemeRecord | null {
  const activeThemeId = pickActiveTheme(themes, defaultTheme);
  return themes.find((theme) => getThemeId(theme) === activeThemeId) ?? null;
}

function parseThemeOverrides(theme: ThemeRecord | null): Record<string, unknown> {
  if (!theme?.overrides || typeof theme.overrides !== 'string') {
    return {};
  }

  try {
    return JSON.parse(theme.overrides) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readThemeValue(
  key: string,
  overrides: Record<string, unknown>,
  resolvedTokens: Record<string, unknown>,
): string | null {
  const raw = resolvedTokens[key] ?? overrides[key];
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  return String(raw);
}

export function resolveThemeDocumentState(
  themes: ThemeRecord[],
  resolvedTokens: Record<string, unknown> = {},
  defaultTheme = 'light',
): ThemeDocumentState {
  const theme = pickActiveThemeRecord(themes, defaultTheme);
  const overrides = parseThemeOverrides(theme);
  const id = theme ? getThemeId(theme) : defaultTheme;
  const mode = readThemeValue('mode', overrides, resolvedTokens);
  const density = readThemeValue('density', overrides, resolvedTokens);
  const motif = readThemeValue('motif', overrides, resolvedTokens);
  const styleProfile = readThemeValue('styleProfile', overrides, resolvedTokens);
  const sourceType = readThemeValue('sourceType', overrides, resolvedTokens);

  const cssVariables: Record<string, string> = {};
  if (mode) cssVariables['--theme-mode'] = mode;
  if (density) cssVariables['--theme-density'] = density;
  if (motif) cssVariables['--theme-motif'] = motif;
  if (styleProfile) cssVariables['--theme-style-profile'] = styleProfile;
  if (sourceType) cssVariables['--theme-source-type'] = sourceType;

  return {
    id,
    mode,
    density,
    motif,
    styleProfile,
    sourceType,
    cssVariables,
  };
}

function setDocumentDataAttribute(name: string, value: string | null) {
  if (typeof document === 'undefined') return;
  if (value) {
    document.documentElement.dataset[name] = value;
  } else {
    delete document.documentElement.dataset[name];
  }
}

function clearThemeCssVariables() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty('--theme-mode');
  document.documentElement.style.removeProperty('--theme-density');
  document.documentElement.style.removeProperty('--theme-motif');
  document.documentElement.style.removeProperty('--theme-style-profile');
  document.documentElement.style.removeProperty('--theme-source-type');
}

export function applyDocumentTheme(theme: string | ThemeDocumentState) {
  if (typeof document === 'undefined') return;
  if (typeof theme === 'string') {
    document.documentElement.dataset.theme = theme;
    return;
  }

  document.documentElement.dataset.theme = theme.id;
  setDocumentDataAttribute('mode', theme.mode);
  setDocumentDataAttribute('density', theme.density);
  setDocumentDataAttribute('motif', theme.motif);
  setDocumentDataAttribute('styleProfile', theme.styleProfile);
  setDocumentDataAttribute('sourceType', theme.sourceType);

  clearThemeCssVariables();
  for (const [key, value] of Object.entries(theme.cssVariables)) {
    document.documentElement.style.setProperty(key, value);
  }
}
