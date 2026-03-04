import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ComposeAdapterStorage, ComposeAdapterNormalizeInput, ComposeAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface ComposeAdapterError { readonly code: string; readonly message: string; }
export interface ComposeAdapterHandler {
  readonly normalize: (input: ComposeAdapterNormalizeInput, storage: ComposeAdapterStorage) => TE.TaskEither<ComposeAdapterError, ComposeAdapterNormalizeOutput>;
}

const WIDGET_MAP: Record<string, string> = {
  button: 'Button',
  text: 'Text',
  card: 'Card',
  container: 'Column',
  image: 'Image',
  input: 'TextField',
  list: 'LazyColumn',
  switch: 'Switch',
  checkbox: 'Checkbox',
  slider: 'Slider',
};

const err = (error: unknown): ComposeAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const composeAdapterHandler: ComposeAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.props);
    } catch {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }

    const hasExplicitType = parsed.type != null;
    const widgetType = (parsed.type as string) ?? input.adapter;
    let composable = WIDGET_MAP[widgetType];
    if (!composable && hasExplicitType) {
      return normalizeError(`Unknown widget type: ${widgetType}`);
    }
    if (!composable) {
      composable = 'Column';
    }

    // Handle container direction
    if (widgetType === 'container' && parsed.direction === 'horizontal') {
      composable = 'Row';
    }

    // Build modifier chain from layout props
    const modifierChain: string[] = [];
    if (parsed.padding !== undefined) modifierChain.push('padding');
    if (parsed.width === 'match_parent') modifierChain.push('fillMaxWidth');
    if (parsed.height === 'match_parent') modifierChain.push('fillMaxHeight');
    if (parsed.cornerRadius !== undefined) modifierChain.push('clip');

    const normalized = JSON.stringify({ composable, modifierChain, props: parsed });
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized });
    return normalizeOk(input.adapter, normalized);
  }, err)),
};
