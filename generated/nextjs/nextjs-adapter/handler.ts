// NextjsAdapter — handler.ts
// Next.js framework adapter: normalizes widget props into Next.js component
// representations with SSR/SSG rendering strategy annotations, App Router
// conventions (use client/server directives), and Next.js-specific optimizations
// such as Image, Link, and dynamic import markers.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NextjsAdapterStorage,
  NextjsAdapterNormalizeInput,
  NextjsAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface NextjsAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface NextjsAdapterHandler {
  readonly normalize: (
    input: NextjsAdapterNormalizeInput,
    storage: NextjsAdapterStorage,
  ) => TE.TaskEither<NextjsAdapterError, NextjsAdapterNormalizeOutput>;
}

// --- Next.js component classification ---

/** Components that should be client-side by default (contain interactivity) */
const CLIENT_COMPONENTS: ReadonlySet<string> = new Set([
  'Button', 'Form', 'Input', 'Select', 'Dialog', 'Modal',
  'Dropdown', 'Tabs', 'Accordion', 'Toast', 'Tooltip',
]);

/** Components with Next.js-specific optimized equivalents */
const NEXTJS_OPTIMIZED: Readonly<Record<string, string>> = {
  'img': 'Image',
  'image': 'Image',
  'a': 'Link',
  'link': 'Link',
  'script': 'Script',
  'head': 'Head',
};

/** Rendering strategies */
type RenderStrategy = 'static' | 'ssr' | 'isr' | 'client';

/** Props that indicate the component needs client-side rendering */
const CLIENT_INDICATOR_PROPS: ReadonlySet<string> = new Set([
  'onClick', 'onChange', 'onSubmit', 'onFocus', 'onBlur',
  'useState', 'useEffect', 'useRef', 'useReducer',
]);

const storageError = (error: unknown): NextjsAdapterError => ({
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

/** Determine whether a component requires 'use client' directive */
const requiresClientDirective = (
  component: string,
  props: Readonly<Record<string, unknown>>,
): boolean => {
  if (CLIENT_COMPONENTS.has(component)) return true;
  return Object.keys(props).some((key) => CLIENT_INDICATOR_PROPS.has(key));
};

/** Determine rendering strategy based on props and component type */
const resolveRenderStrategy = (
  props: Readonly<Record<string, unknown>>,
  isClient: boolean,
): RenderStrategy => {
  if (isClient) return 'client';
  if (typeof props['revalidate'] === 'number') return 'isr';
  if (props['getServerSideProps'] === true || props['ssr'] === true) return 'ssr';
  return 'static';
};

/** Map Image-specific props to Next.js Image optimization props */
const normalizeImageProps = (props: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...props };
  // Ensure width/height are present for Next.js Image
  if (result['src'] !== undefined) {
    if (result['width'] === undefined) result['width'] = 0;
    if (result['height'] === undefined) result['height'] = 0;
    // Map loading attribute
    if (result['loading'] === undefined) result['loading'] = 'lazy';
    // Map priority
    if (result['priority'] === undefined) result['priority'] = false;
  }
  return result;
};

/** Map Link-specific props to Next.js Link conventions */
const normalizeLinkProps = (props: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...props };
  if (result['href'] !== undefined && result['prefetch'] === undefined) {
    result['prefetch'] = true;
  }
  return result;
};

/** Resolve component name, applying Next.js optimized substitutions */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'div';
  const optimized = NEXTJS_OPTIMIZED[raw.toLowerCase()];
  return optimized ?? raw;
};

/** Transform props based on target component type */
const transformProps = (
  component: string,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  if (component === 'Image') return normalizeImageProps(props);
  if (component === 'Link') return normalizeLinkProps(props);
  return props;
};

// --- Implementation ---

export const nextjsAdapterHandler: NextjsAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for Next.js adapter "${input.adapter}"`),
              (parsed) => {
                const isClient = requiresClientDirective(component, parsed);
                const strategy = resolveRenderStrategy(parsed, isClient);
                const transformedProps = transformProps(component, { ...parsed });
                const normalized = JSON.stringify({
                  component,
                  props: transformedProps,
                  platform: 'nextjs',
                  framework: 'next',
                  directive: isClient ? 'use client' : 'use server',
                  renderStrategy: strategy,
                  appRouter: true,
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
                  await storage.put('nextjsadapter', input.adapter, {
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
