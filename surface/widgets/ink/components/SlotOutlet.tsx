// ============================================================
// Clef Surface Ink Widget — SlotOutlet
//
// Named placeholder in terminal layout using Ink. Renders
// default content when no fill is provided, or renders the
// filled content when a slot is populated. Supports scoped
// data passing and a registry for managing multiple slots.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Box, Text } from 'ink';

import type { SlotConfig } from '../../shared/types.js';

// --------------- Slot Registry Context ---------------

export interface SlotFill {
  name: string;
  content: ReactNode;
}

export interface SlotRegistryContextValue {
  /** Register default content for a slot. */
  registerSlot(name: string, defaultContent?: ReactNode): void;
  /** Fill a slot with content. */
  fillSlot(name: string, content: ReactNode): void;
  /** Clear a slot's filled content. */
  clearSlot(name: string): void;
  /** Check if a slot has filled content. */
  isFilled(name: string): boolean;
  /** Get filled content for a slot. */
  getFilledContent(name: string): ReactNode | undefined;
  /** Get all registered slot names. */
  getSlotNames(): string[];
}

const SlotRegistryContext = createContext<SlotRegistryContextValue | null>(null);

export function useSlotFill(): SlotRegistryContextValue {
  const ctx = useContext(SlotRegistryContext);
  if (!ctx) {
    throw new Error('useSlotFill must be used within a <SlotProvider>.');
  }
  return ctx;
}

// --------------- SlotProvider ---------------

export interface SlotProviderProps {
  children: ReactNode;
}

export const SlotProvider: React.FC<SlotProviderProps> = ({ children }) => {
  const [fills, setFills] = useState<Map<string, ReactNode>>(new Map());
  const [defaults, setDefaults] = useState<Map<string, ReactNode>>(new Map());

  const registerSlot = useCallback((name: string, defaultContent?: ReactNode) => {
    setDefaults((prev) => {
      const next = new Map(prev);
      next.set(name, defaultContent);
      return next;
    });
  }, []);

  const fillSlot = useCallback((name: string, content: ReactNode) => {
    setFills((prev) => {
      const next = new Map(prev);
      next.set(name, content);
      return next;
    });
  }, []);

  const clearSlot = useCallback((name: string) => {
    setFills((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const isFilled = useCallback(
    (name: string) => fills.has(name),
    [fills],
  );

  const getFilledContent = useCallback(
    (name: string) => fills.get(name),
    [fills],
  );

  const getSlotNames = useCallback(
    () => Array.from(defaults.keys()),
    [defaults],
  );

  const value = useMemo<SlotRegistryContextValue>(
    () => ({ registerSlot, fillSlot, clearSlot, isFilled, getFilledContent, getSlotNames }),
    [registerSlot, fillSlot, clearSlot, isFilled, getFilledContent, getSlotNames],
  );

  return (
    <SlotRegistryContext.Provider value={value}>
      {children}
    </SlotRegistryContext.Provider>
  );
};

SlotProvider.displayName = 'SlotProvider';

// --------------- SlotOutlet Props ---------------

export interface SlotOutletProps {
  /** Name of the slot. */
  name: string;
  /** Default content to render when slot is not filled. */
  defaultContent?: ReactNode;
  /** Filled content (provided by parent). */
  filledContent?: ReactNode;
  /** Scoped data passed to slot consumers. */
  scope?: Record<string, unknown>;
  /** Whether to show slot debug information. */
  debug?: boolean;
  /** Width constraint for the slot area. */
  width?: number;
  /** Whether to render a border around the slot region. */
  showBorder?: boolean;
  /** Accent color for debug info. */
  accentColor?: string;
}

// --------------- SlotOutlet Component ---------------

export const SlotOutlet: React.FC<SlotOutletProps> = ({
  name,
  defaultContent,
  filledContent,
  scope,
  debug = false,
  width,
  showBorder = false,
  accentColor = 'magenta',
}) => {
  // Try to get filled content from context if not provided directly
  const registry = useContext(SlotRegistryContext);
  const contextFill = registry?.getFilledContent(name);

  const hasFill = filledContent !== undefined || contextFill !== undefined;
  const content = filledContent ?? contextFill ?? defaultContent;

  return (
    <Box flexDirection="column" width={width}>
      {debug && (
        <Box>
          <Text dimColor color={accentColor}>◈ slot:</Text>
          <Text color={accentColor}>{name}</Text>
          <Text> </Text>
          <Text color={hasFill ? 'cyan' : 'yellow'}>
            {hasFill ? 'filled' : 'default'}
          </Text>
          {scope && (
            <Text dimColor> scope:{'{' + Object.keys(scope).join(',') + '}'}</Text>
          )}
        </Box>
      )}

      {showBorder ? (
        <Box
          flexDirection="column"
          borderStyle="single"
          dimBorder
          paddingX={1}
          width={width}
        >
          <Text italic dimColor>{name}</Text>
          {content}
        </Box>
      ) : (
        content
      )}

      {!content && debug && (
        <Text dimColor italic>(empty slot: {name})</Text>
      )}
    </Box>
  );
};

SlotOutlet.displayName = 'SlotOutlet';

// --------------- Create slot from Clef Surface config ---------------

export const SlotFromConfig: React.FC<{
  config: SlotConfig;
  filledContent?: ReactNode;
  debug?: boolean;
}> = ({ config, filledContent, debug = false }) => (
  <SlotOutlet
    name={config.name}
    defaultContent={
      config.defaultContent
        ? <Text>{String(config.defaultContent)}</Text>
        : undefined
    }
    filledContent={filledContent}
    scope={config.scope}
    debug={debug}
  />
);

SlotFromConfig.displayName = 'SlotFromConfig';

export { SlotRegistryContext };
export default SlotOutlet;
