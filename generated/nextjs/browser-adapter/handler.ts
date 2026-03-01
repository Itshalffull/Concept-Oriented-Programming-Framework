// BrowserAdapter — Normalizes Clef widget props into Web DOM element equivalents.
// Maps abstract layout, typography, and interaction properties to HTML elements, CSS, and DOM events.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  BrowserAdapterStorage,
  BrowserAdapterNormalizeInput,
  BrowserAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface BrowserAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface BrowserAdapterHandler {
  readonly normalize: (
    input: BrowserAdapterNormalizeInput,
    storage: BrowserAdapterStorage,
  ) => TE.TaskEither<BrowserAdapterError, BrowserAdapterNormalizeOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): BrowserAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map of abstract widget types to their HTML element equivalents. */
const WIDGET_TO_ELEMENT: Readonly<Record<string, string>> = {
  text: 'span',
  heading: 'h2',
  paragraph: 'p',
  button: 'button',
  image: 'img',
  container: 'div',
  scroll: 'div',
  list: 'ul',
  listItem: 'li',
  input: 'input',
  textarea: 'textarea',
  toggle: 'input[type="checkbox"]',
  slider: 'input[type="range"]',
  progress: 'progress',
  divider: 'hr',
  link: 'a',
  form: 'form',
  section: 'section',
  article: 'article',
  nav: 'nav',
  header: 'header',
  footer: 'footer',
  main: 'main',
  aside: 'aside',
  table: 'table',
  dialog: 'dialog',
  details: 'details',
  video: 'video',
  audio: 'audio',
  canvas: 'canvas',
};

/** Parse props JSON into a record. */
const parseProps = (props: string): Record<string, unknown> | null =>
  pipe(
    O.tryCatch(() => JSON.parse(props) as Record<string, unknown>),
    O.toNullable,
  );

/** Normalize abstract layout properties to CSS style declarations. */
const normalizeLayout = (props: Record<string, unknown>): Record<string, string> => {
  const styles: Record<string, string> = {};

  const direction = props['direction'] as string | undefined;
  if (direction !== undefined) {
    styles['display'] = 'flex';
    styles['flex-direction'] = direction === 'horizontal' ? 'row' : 'column';
  }

  const padding = props['padding'] as number | string | undefined;
  if (padding !== undefined) {
    styles['padding'] = typeof padding === 'number' ? `${padding}px` : padding;
  }

  const margin = props['margin'] as number | string | undefined;
  if (margin !== undefined) {
    styles['margin'] = typeof margin === 'number' ? `${margin}px` : margin;
  }

  const spacing = props['spacing'] as number | undefined;
  if (spacing !== undefined) {
    styles['gap'] = `${spacing}px`;
  }

  const alignment = props['alignment'] as string | undefined;
  if (alignment !== undefined) {
    const alignMap: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      stretch: 'stretch',
    };
    styles['align-items'] = alignMap[alignment] ?? alignment;
  }

  const width = props['width'] as number | string | undefined;
  if (width !== undefined) {
    styles['width'] = typeof width === 'number' ? `${width}px` : width;
  }

  const height = props['height'] as number | string | undefined;
  if (height !== undefined) {
    styles['height'] = typeof height === 'number' ? `${height}px` : height;
  }

  return styles;
};

/** Normalize abstract interaction properties to DOM event handler names. */
const normalizeInteraction = (props: Record<string, unknown>): Record<string, string> => {
  const events: Record<string, string> = {};

  if (props['onClick'] !== undefined) events['onclick'] = 'handleClick';
  if (props['onHover'] !== undefined) events['onmouseenter'] = 'handleHover';
  if (props['onFocus'] !== undefined) events['onfocus'] = 'handleFocus';
  if (props['onBlur'] !== undefined) events['onblur'] = 'handleBlur';
  if (props['onChange'] !== undefined) events['onchange'] = 'handleChange';
  if (props['onSubmit'] !== undefined) events['onsubmit'] = 'handleSubmit';
  if (props['onKeyDown'] !== undefined) events['onkeydown'] = 'handleKeyDown';
  if (props['onScroll'] !== undefined) events['onscroll'] = 'handleScroll';

  return events;
};

/** Normalize accessibility properties to ARIA attributes. */
const normalizeAccessibility = (props: Record<string, unknown>): Record<string, string> => {
  const aria: Record<string, string> = {};

  const label = props['accessibilityLabel'] as string | undefined;
  if (label !== undefined) aria['aria-label'] = label;

  const role = props['role'] as string | undefined;
  if (role !== undefined) aria['role'] = role;

  const hidden = props['accessibilityHidden'] as boolean | undefined;
  if (hidden !== undefined) aria['aria-hidden'] = String(hidden);

  return aria;
};

// --- Implementation ---

export const browserAdapterHandler: BrowserAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const parsed = parseProps(input.props);

          if (parsed === null) {
            return normalizeError(
              `Failed to parse props for adapter '${input.adapter}': invalid JSON`,
            );
          }

          // Resolve the HTML element for this widget type
          const widgetType = (parsed['type'] as string | undefined) ?? input.adapter;
          const element = WIDGET_TO_ELEMENT[widgetType.toLowerCase()];

          if (element === undefined) {
            return normalizeError(
              `No DOM element mapping for widget type '${widgetType}'`,
            );
          }

          const styles = normalizeLayout(parsed);
          const events = normalizeInteraction(parsed);
          const aria = normalizeAccessibility(parsed);

          const normalizedOutput: Record<string, unknown> = {
            element,
            styles,
            events,
            aria,
          };

          // Include standard HTML attributes
          const id = parsed['id'] as string | undefined;
          if (id !== undefined) normalizedOutput['id'] = id;

          const className = parsed['className'] as string | undefined;
          if (className !== undefined) normalizedOutput['className'] = className;

          const normalizedJson = JSON.stringify(normalizedOutput);

          await storage.put('normalizations', `${input.adapter}:${widgetType}`, {
            adapter: input.adapter,
            widgetType,
            element,
            normalized: normalizedJson,
          });

          return normalizeOk(input.adapter, normalizedJson);
        },
        storageError,
      ),
    ),
};
