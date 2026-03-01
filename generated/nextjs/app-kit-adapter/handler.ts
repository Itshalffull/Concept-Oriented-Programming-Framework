// AppKitAdapter — Normalizes Clef widget props into macOS AppKit NSView hierarchy equivalents.
// Maps abstract layout, typography, and interaction properties to AppKit-native constructs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AppKitAdapterStorage,
  AppKitAdapterNormalizeInput,
  AppKitAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface AppKitAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface AppKitAdapterHandler {
  readonly normalize: (
    input: AppKitAdapterNormalizeInput,
    storage: AppKitAdapterStorage,
  ) => TE.TaskEither<AppKitAdapterError, AppKitAdapterNormalizeOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): AppKitAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map of abstract widget types to their AppKit NSView class equivalents. */
const WIDGET_TO_NSVIEW: Readonly<Record<string, string>> = {
  text: 'NSTextField',
  button: 'NSButton',
  image: 'NSImageView',
  container: 'NSStackView',
  scroll: 'NSScrollView',
  list: 'NSTableView',
  input: 'NSTextField',
  toggle: 'NSSwitch',
  slider: 'NSSlider',
  progress: 'NSProgressIndicator',
  divider: 'NSBox',
  grid: 'NSGridView',
  tab: 'NSTabView',
  split: 'NSSplitView',
  outline: 'NSOutlineView',
  browser: 'NSBrowser',
  collection: 'NSCollectionView',
};

/** Parse props JSON into a record with layout, style, and interaction fields. */
const parseProps = (props: string): Record<string, unknown> | null =>
  pipe(
    O.tryCatch(() => JSON.parse(props) as Record<string, unknown>),
    O.toNullable,
  );

/** Normalize abstract layout properties to NSView autolayout constraints and properties. */
const normalizeLayout = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  const padding = props['padding'] as number | undefined;
  if (padding !== undefined) {
    normalized['edgeInsets'] = { top: padding, left: padding, bottom: padding, right: padding };
  }

  const direction = props['direction'] as string | undefined;
  if (direction !== undefined) {
    normalized['orientation'] = direction === 'horizontal'
      ? 'NSUserInterfaceLayoutOrientation.horizontal'
      : 'NSUserInterfaceLayoutOrientation.vertical';
  }

  const alignment = props['alignment'] as string | undefined;
  if (alignment !== undefined) {
    const alignmentMap: Record<string, string> = {
      start: 'NSLayoutConstraint.FormatOptions.alignAllLeading',
      center: 'NSLayoutConstraint.FormatOptions.alignAllCenterX',
      end: 'NSLayoutConstraint.FormatOptions.alignAllTrailing',
    };
    normalized['alignment'] = alignmentMap[alignment] ?? alignment;
  }

  const spacing = props['spacing'] as number | undefined;
  if (spacing !== undefined) {
    normalized['spacing'] = spacing;
  }

  return normalized;
};

/** Normalize abstract interaction properties to AppKit action/target patterns. */
const normalizeInteraction = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  if (props['onClick'] !== undefined) {
    normalized['action'] = '#selector(handleClick:)';
    normalized['target'] = 'self';
  }

  if (props['onDoubleClick'] !== undefined) {
    normalized['doubleAction'] = '#selector(handleDoubleClick:)';
  }

  if (props['enabled'] !== undefined) {
    normalized['isEnabled'] = props['enabled'];
  }

  if (props['hidden'] !== undefined) {
    normalized['isHidden'] = props['hidden'];
  }

  return normalized;
};

// --- Implementation ---

export const appKitAdapterHandler: AppKitAdapterHandler = {
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

          // Resolve the AppKit NSView class for this adapter type
          const widgetType = (parsed['type'] as string | undefined) ?? input.adapter;
          const nsViewClass = WIDGET_TO_NSVIEW[widgetType.toLowerCase()];

          if (nsViewClass === undefined) {
            return normalizeError(
              `No AppKit NSView mapping for widget type '${widgetType}'`,
            );
          }

          // Build normalized output combining layout, interaction, and view class
          const layoutProps = normalizeLayout(parsed);
          const interactionProps = normalizeInteraction(parsed);

          const normalizedOutput: Record<string, unknown> = {
            viewClass: nsViewClass,
            ...layoutProps,
            ...interactionProps,
          };

          const normalizedJson = JSON.stringify(normalizedOutput);

          // Cache the normalization result for future lookups
          await storage.put('normalizations', `${input.adapter}:${widgetType}`, {
            adapter: input.adapter,
            widgetType,
            nsViewClass,
            normalized: normalizedJson,
          });

          return normalizeOk(input.adapter, normalizedJson);
        },
        storageError,
      ),
    ),
};
