// ============================================================
// SlotOutlet — Named slot insertion point for Clef Surface component
// composition.
//
// Renders default content if no "fill" is provided from the
// parent scope, or the filled content when supplied.  Supports
// scoped slots via a render-prop interface.
// ============================================================

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type { SlotConfig } from '../../shared/types.js';

// --------------- Slot Fill Registry Context ---------------

/**
 * A fill is either a ReactNode (static content) or a render
 * function (scoped slot) that receives the slot's scope data.
 */
export type SlotFill =
  | ReactNode
  | ((scope: Record<string, unknown>) => ReactNode);

export interface SlotRegistryContextValue {
  /** Look up a fill by slot name. */
  getFill(slotName: string): SlotFill | undefined;
  /** Register a fill for a slot name. */
  setFill(slotName: string, fill: SlotFill): void;
}

const SlotRegistryContext = createContext<SlotRegistryContextValue | null>(null);

// --------------- SlotProvider ---------------

export interface SlotProviderProps {
  /**
   * Map of slot names to their fills.
   * Example: { header: <MyHeader />, footer: (scope) => <Footer count={scope.count} /> }
   */
  fills: Record<string, SlotFill>;
  children: ReactNode;
}

/**
 * Provides slot fills to all nested SlotOutlet components.
 */
export const SlotProvider: React.FC<SlotProviderProps> = ({
  fills,
  children,
}) => {
  const contextValue = useMemo<SlotRegistryContextValue>(
    () => ({
      getFill: (name: string) => fills[name],
      setFill: () => {
        // In this declarative model, fills are set via props.
        // A mutable registry could be added for imperative use.
      },
    }),
    [fills]
  );

  return (
    <SlotRegistryContext.Provider value={contextValue}>
      {children}
    </SlotRegistryContext.Provider>
  );
};

SlotProvider.displayName = 'SlotProvider';

// --------------- Hook ---------------

export function useSlotFill(slotName: string): SlotFill | undefined {
  const registry = useContext(SlotRegistryContext);
  return registry?.getFill(slotName);
}

// --------------- SlotOutlet Props ---------------

export interface SlotOutletProps {
  /** The slot name to look up in the fill registry. */
  name: string;
  /**
   * Default content rendered when no fill is registered.
   * Can be a ReactNode or a render function for scoped defaults.
   */
  defaultContent?: SlotFill;
  /**
   * Scope data passed to render-function fills and defaults.
   * Enables the scoped-slot pattern where the slot provider
   * gives data back to the fill author.
   */
  scope?: Record<string, unknown>;
  /** Wrapper element tag. @default none (Fragment) */
  as?: keyof JSX.IntrinsicElements;
  /** Additional class name (only when 'as' is provided). */
  className?: string;
  /** Additional inline styles (only when 'as' is provided). */
  style?: CSSProperties;
}

// --------------- Helpers ---------------

function renderFill(
  fill: SlotFill,
  scope: Record<string, unknown>
): ReactNode {
  if (typeof fill === 'function') {
    return fill(scope);
  }
  return fill;
}

// --------------- Component ---------------

export const SlotOutlet: React.FC<SlotOutletProps> = ({
  name,
  defaultContent,
  scope = {},
  as: Tag,
  className,
  style,
}) => {
  const fill = useSlotFill(name);

  const content = useMemo(() => {
    if (fill !== undefined && fill !== null) {
      return renderFill(fill, scope);
    }
    if (defaultContent !== undefined && defaultContent !== null) {
      return renderFill(defaultContent, scope);
    }
    return null;
  }, [fill, defaultContent, scope]);

  if (content === null) return null;

  if (Tag) {
    return (
      <Tag
        className={className}
        style={style}
        data-surface-slot=""
        data-slot-name={name}
        data-slot-filled={fill !== undefined ? '' : undefined}
      >
        {content}
      </Tag>
    );
  }

  return <>{content}</>;
};

SlotOutlet.displayName = 'SlotOutlet';
export { SlotRegistryContext };
export default SlotOutlet;
