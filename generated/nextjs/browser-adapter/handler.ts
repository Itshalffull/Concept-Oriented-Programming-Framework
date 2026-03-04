import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { BrowserAdapterStorage, BrowserAdapterNormalizeInput, BrowserAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface BrowserAdapterError { readonly code: string; readonly message: string; }
export interface BrowserAdapterHandler {
  readonly normalize: (input: BrowserAdapterNormalizeInput, storage: BrowserAdapterStorage) => TE.TaskEither<BrowserAdapterError, BrowserAdapterNormalizeOutput>;
}

const ELEMENT_MAP: Record<string, string> = {
  button: 'button',
  text: 'span',
  container: 'div',
  image: 'img',
  input: 'input',
  label: 'label',
  list: 'ul',
  link: 'a',
  navigation: 'nav',
  header: 'header',
  footer: 'footer',
  section: 'section',
  form: 'form',
  select: 'select',
  textarea: 'textarea',
};

const err = (error: unknown): BrowserAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const browserAdapterHandler: BrowserAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(input.props); } catch { return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`); }
    const widgetType = (parsed.type as string) ?? input.adapter;
    const element = ELEMENT_MAP[widgetType];
    if (!element) return normalizeError(`Unknown widget type: ${widgetType}`);

    const styles: Record<string, string> = {};
    if (parsed.padding != null) styles['padding'] = `${parsed.padding}px`;
    if (parsed.margin != null) styles['margin'] = `${parsed.margin}px`;
    if (parsed.direction === 'horizontal') styles['flex-direction'] = 'row';
    if (parsed.direction === 'vertical') styles['flex-direction'] = 'column';
    if (parsed.spacing != null) styles['gap'] = `${parsed.spacing}px`;

    const aria: Record<string, string> = {};
    if (parsed.accessibilityLabel) aria['aria-label'] = String(parsed.accessibilityLabel);
    if (parsed.role) aria['role'] = String(parsed.role);

    const events: Record<string, string> = {};
    if (parsed.onClick) events['onclick'] = 'handleClick';
    if (parsed.onHover) events['onmouseenter'] = 'handleHover';

    const normalized = { element, styles, aria, events, ...parsed };
    const normalizedStr = JSON.stringify(normalized);
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedStr });
    return normalizeOk(input.adapter, normalizedStr);
  }, err)),
};
