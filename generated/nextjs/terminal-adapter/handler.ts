// TerminalAdapter — handler.ts
// Terminal TUI adapter: normalizes widget props into terminal user interface
// representations. Maps layout to character-cell grid positioning, handles
// ANSI color/style codes, box-drawing characters, and constrained viewport
// dimensions typical of terminal emulators.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TerminalAdapterStorage,
  TerminalAdapterNormalizeInput,
  TerminalAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface TerminalAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface TerminalAdapterHandler {
  readonly normalize: (
    input: TerminalAdapterNormalizeInput,
    storage: TerminalAdapterStorage,
  ) => TE.TaskEither<TerminalAdapterError, TerminalAdapterNormalizeOutput>;
}

// --- Terminal UI primitives and ANSI mappings ---

/** TUI widget types */
const TUI_WIDGETS: ReadonlySet<string> = new Set([
  'Box', 'Text', 'Table', 'List', 'Input', 'Progress',
  'Spinner', 'Tree', 'Tabs', 'Panel', 'StatusBar', 'Menu',
  'Dialog', 'Gauge', 'Sparkline', 'Canvas',
]);

/** Map CSS-like colors to ANSI color names */
const COLOR_TO_ANSI: Readonly<Record<string, string>> = {
  'black': 'black',
  'red': 'red',
  'green': 'green',
  'yellow': 'yellow',
  'blue': 'blue',
  'magenta': 'magenta',
  'cyan': 'cyan',
  'white': 'white',
  'gray': 'brightBlack',
  'grey': 'brightBlack',
};

/** Box-drawing border styles */
const BORDER_STYLES: Readonly<Record<string, string>> = {
  'single': 'single',
  'double': 'double',
  'rounded': 'rounded',
  'bold': 'bold',
  'none': 'none',
  'solid': 'single',
  'dashed': 'single',
};

/** Default terminal viewport constraints */
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

const storageError = (error: unknown): TerminalAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const parseProps = (raw: string): O.Option<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? O.some(parsed as Record<string, unknown>)
      : O.none;
  } catch {
    return O.none;
  }
};

/** Resolve ANSI color from CSS-like color value */
const resolveAnsiColor = (color: unknown): string | undefined => {
  if (typeof color !== 'string') return undefined;
  const lower = color.toLowerCase().replace('#', '').trim();
  return COLOR_TO_ANSI[lower] ?? (color.startsWith('#') ? color : undefined);
};

/** Transform generic props into terminal-aware attributes */
const transformTerminalProps = (
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const styles: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    switch (key) {
      case 'color':
      case 'foreground': {
        const ansi = resolveAnsiColor(value);
        if (ansi !== undefined) styles['fg'] = ansi;
        break;
      }
      case 'background-color':
      case 'backgroundColor':
      case 'background': {
        const ansi = resolveAnsiColor(value);
        if (ansi !== undefined) styles['bg'] = ansi;
        break;
      }
      case 'bold':
        if (value) styles['bold'] = true;
        break;
      case 'italic':
        if (value) styles['italic'] = true;
        break;
      case 'underline':
        if (value) styles['underline'] = true;
        break;
      case 'strikethrough':
        if (value) styles['strikethrough'] = true;
        break;
      case 'dim':
        if (value) styles['dim'] = true;
        break;
      case 'border':
      case 'borderStyle': {
        const borderVal = typeof value === 'string' ? BORDER_STYLES[value] : undefined;
        result['border'] = borderVal ?? 'single';
        break;
      }
      case 'width':
        result['width'] = typeof value === 'number'
          ? Math.min(value, DEFAULT_COLS)
          : value;
        break;
      case 'height':
        result['height'] = typeof value === 'number'
          ? Math.min(value, DEFAULT_ROWS)
          : value;
        break;
      case 'padding':
        result['padding'] = typeof value === 'number' ? Math.max(0, value) : value;
        break;
      case 'align':
      case 'text-align':
      case 'textAlign':
        result['align'] = value === 'center' ? 'center'
          : value === 'right' ? 'right' : 'left';
        break;
      case 'wrap':
        result['wrap'] = value === false ? 'truncate' : 'wrap';
        break;
      default:
        result[key] = value;
    }
  }

  if (Object.keys(styles).length > 0) {
    result['style'] = styles;
  }

  return result;
};

/** Resolve the TUI widget from adapter string */
const resolveWidget = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'Box';
  return TUI_WIDGETS.has(component) ? component : 'Box';
};

// --- Implementation ---

export const terminalAdapterHandler: TerminalAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const widget = resolveWidget(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for terminal adapter "${input.adapter}"`),
              (parsed) => {
                const tuiProps = transformTerminalProps(parsed);
                const normalized = JSON.stringify({
                  widget,
                  props: tuiProps,
                  platform: 'terminal',
                  renderTarget: 'tty',
                  viewport: { cols: DEFAULT_COLS, rows: DEFAULT_ROWS },
                  ansiSupport: true,
                });
                return normalizeOk(input.adapter, normalized);
              },
            ),
          );
        },
        storageError,
      ),
      TE.chain((result) =>
        result.variant === 'error'
          ? TE.right(result)
          : pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('terminaladapter', input.adapter, {
                    adapter: input.adapter,
                    normalized: result.normalized,
                    timestamp: Date.now(),
                  });
                  return result;
                },
                storageError,
              ),
            ),
      ),
    ),
};
