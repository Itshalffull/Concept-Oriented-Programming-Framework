import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AppKitAdapterStorage, AppKitAdapterNormalizeInput, AppKitAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface AppKitAdapterError { readonly code: string; readonly message: string; }
export interface AppKitAdapterHandler {
  readonly normalize: (input: AppKitAdapterNormalizeInput, storage: AppKitAdapterStorage) => TE.TaskEither<AppKitAdapterError, AppKitAdapterNormalizeOutput>;
}

const err = (error: unknown): AppKitAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

const VIEW_MAP: Record<string, string> = {
  button: 'NSButton',
  text: 'NSTextField',
  container: 'NSStackView',
  image: 'NSImageView',
  label: 'NSTextField',
  list: 'NSTableView',
  input: 'NSTextField',
  slider: 'NSSlider',
  checkbox: 'NSButton',
  switch: 'NSSwitch',
};

export const appKitAdapterHandler: AppKitAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(input.props); } catch { return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`); }
    const hasExplicitType = parsed.type != null;
    const widgetType = (parsed.type as string) ?? input.adapter;
    const viewClass = VIEW_MAP[widgetType];
    if (!viewClass && hasExplicitType) return normalizeError(`Unknown widget type: ${widgetType}`);
    const normalized: Record<string, unknown> = { viewClass: viewClass ?? 'NSView', ...parsed };
    if (widgetType === 'container') {
      if (parsed.padding != null) normalized.edgeInsets = { top: parsed.padding, left: parsed.padding, bottom: parsed.padding, right: parsed.padding };
      if (parsed.spacing != null) normalized.spacing = parsed.spacing;
    }
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: JSON.stringify(normalized) });
    return normalizeOk(input.adapter, JSON.stringify(normalized));
  }, err)),
};
