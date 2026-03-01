// ============================================================
// Clef Surface Next.js Widget Components — Root Barrel Export
//
// Re-exports all widget components organized by category.
// Each category barrel re-exports its individual components.
// ============================================================

// --- Shared Hooks ---
export {
  useControllableState,
  useRovingFocus,
  useOutsideClick,
  useFloatingPosition,
  useFocusReturn,
  useScrollLock,
  type UseControllableStateProps,
  type UseRovingFocusProps,
  type RovingFocusItem,
  type UseFloatingPositionProps,
  type FloatingPosition,
  type Placement,
} from './shared/index.js';

// --- Primitives ---
export * from './primitives/index.js';

// --- Form Controls ---
export * from './form-controls/index.js';

// --- Feedback ---
export * from './feedback/index.js';

// --- Navigation ---
export * from './navigation/index.js';

// --- Data Display ---
export * from './data-display/index.js';

// --- Complex Inputs ---
export * from './complex-inputs/index.js';

// --- Composites ---
export * from './composites/index.js';

// --- Domain ---
export * from './domain/index.js';
