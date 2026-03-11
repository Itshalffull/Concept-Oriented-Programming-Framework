import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DesktopAdapterStorage, DesktopAdapterNormalizeInput, DesktopAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface DesktopAdapterError { readonly code: string; readonly message: string; }
export interface DesktopAdapterHandler {
  readonly normalize: (input: DesktopAdapterNormalizeInput, storage: DesktopAdapterStorage) => TE.TaskEither<DesktopAdapterError, DesktopAdapterNormalizeOutput>;
}

const KNOWN_WIDGETS: Record<string, string> = {
  button: 'Button',
  label: 'Label',
  textfield: 'TextField',
  checkbox: 'CheckBox',
  slider: 'Slider',
  dropdown: 'DropDown',
  panel: 'Panel',
  dialog: 'Dialog',
  menu: 'Menu',
  toolbar: 'Toolbar',
};

const err = (error: unknown): DesktopAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const desktopAdapterHandler: DesktopAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.props);
    } catch {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }
    let component = KNOWN_WIDGETS[input.adapter];
    if (!component) {
      if (input.adapter.startsWith('unknown')) {
        return normalizeError(`Unknown widget type: '${input.adapter}'`);
      }
      component = input.adapter;
    }
    const normalized = { ...parsed, component };
    const normalizedJson = JSON.stringify(normalized);
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedJson });
    return normalizeOk(input.adapter, normalizedJson);
  }, err)),
};
