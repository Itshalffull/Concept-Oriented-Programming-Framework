// ============================================================
// Clef Surface Ink Widget — SurfaceRoot
//
// Terminal surface manager using Ink. Handles the top-level
// rendering context: title bar, status bar, surface kind
// indicator, background/foreground colors, and exit handling.
// Ink itself manages alt screen buffer, raw mode, and cursor
// visibility, so this component focuses on layout and context.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import type { SurfaceKind } from '../../shared/types.js';

// --------------- Types ---------------

export type SurfaceState = 'idle' | 'active' | 'suspended' | 'destroyed';

export interface SurfaceStatus {
  state: SurfaceState;
  width: number;
  height: number;
  surfaceKind: SurfaceKind;
}

// --------------- Context ---------------

export interface SurfaceContextValue {
  status: SurfaceStatus;
  title?: string;
  exit: () => void;
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null);

export function useSurface(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext);
  if (!ctx) {
    throw new Error('useSurface must be used within a <SurfaceRoot>.');
  }
  return ctx;
}

export function useSurfaceSize(): { width: number; height: number } {
  const { status } = useSurface();
  return { width: status.width, height: status.height };
}

// --------------- Props ---------------

export interface SurfaceRootProps {
  /** Title for the terminal window. */
  title?: string;
  /** Children to render inside the surface. */
  children: ReactNode;
  /** Whether to show a status bar at the bottom. */
  showStatusBar?: boolean;
  /** Custom status bar content. */
  statusBarContent?: string;
  /** Whether to show the surface kind indicator. */
  showSurfaceKind?: boolean;
  /** Background color for the surface. */
  backgroundColor?: string;
  /** Foreground color for the surface. */
  foregroundColor?: string;
  /** Accent color for chrome elements. */
  accentColor?: string;
  /** Width override (defaults to terminal width). */
  width?: number;
  /** Height override (defaults to terminal height). */
  height?: number;
  /** Whether to allow quitting with 'q'. */
  enableQuit?: boolean;
  /** Quit key (defaults to 'q'). */
  quitKey?: string;
  /** Whether this component is focused. */
  isFocused?: boolean;
  /** Callback on exit. */
  onExit?: () => void;
}

// --------------- Component ---------------

export const SurfaceRoot: React.FC<SurfaceRootProps> = ({
  title,
  children,
  showStatusBar = false,
  statusBarContent,
  showSurfaceKind = false,
  backgroundColor,
  foregroundColor,
  accentColor = 'cyan',
  width: widthOverride,
  height: heightOverride,
  enableQuit = true,
  quitKey = 'q',
  isFocused = true,
  onExit,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [dimensions, setDimensions] = useState({
    width: widthOverride || stdout?.columns || 80,
    height: heightOverride || stdout?.rows || 24,
  });

  // Track terminal resize
  useEffect(() => {
    if (widthOverride && heightOverride) return;

    const handleResize = () => {
      setDimensions({
        width: widthOverride || stdout?.columns || 80,
        height: heightOverride || stdout?.rows || 24,
      });
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout, widthOverride, heightOverride]);

  const handleExit = useCallback(() => {
    onExit?.();
    exit();
  }, [exit, onExit]);

  // Handle quit key
  useInput(
    (input) => {
      if (enableQuit && input === quitKey) {
        handleExit();
      }
    },
    { isActive: isFocused },
  );

  const status = useMemo<SurfaceStatus>(
    () => ({
      state: 'active',
      width: dimensions.width,
      height: dimensions.height,
      surfaceKind: 'terminal' as SurfaceKind,
    }),
    [dimensions],
  );

  const contextValue = useMemo<SurfaceContextValue>(
    () => ({
      status,
      title,
      exit: handleExit,
    }),
    [status, title, handleExit],
  );

  const surfaceWidth = dimensions.width;
  const innerWidth = surfaceWidth - 2;

  return (
    <SurfaceContext.Provider value={contextValue}>
      <Box
        flexDirection="column"
        width={surfaceWidth}
        height={heightOverride}
      >
        {/* Surface kind indicator */}
        {showSurfaceKind && (
          <Text dimColor>
            [surface: terminal | {dimensions.width}x{dimensions.height}]
          </Text>
        )}

        {/* Title bar */}
        {title && (
          <Box>
            <Text dimColor>{'─'.repeat(Math.max(0, Math.floor((innerWidth - title.length - 2) / 2)))}</Text>
            <Text bold color={accentColor}> {title} </Text>
            <Text dimColor>{'─'.repeat(Math.max(0, Math.ceil((innerWidth - title.length - 2) / 2)))}</Text>
          </Box>
        )}

        {/* Main content area */}
        <Box
          flexDirection="column"
          flexGrow={1}
        >
          {children}
        </Box>

        {/* Status bar */}
        {showStatusBar && (
          <Box flexDirection="column">
            <Text dimColor>{'─'.repeat(surfaceWidth)}</Text>
            <Box>
              <Text dimColor>
                {statusBarContent || 'Clef Surface Terminal'}
              </Text>
              <Box flexGrow={1} />
              <Text dimColor>
                {dimensions.width}x{dimensions.height}
              </Text>
              {enableQuit && (
                <Text dimColor> | {quitKey}:quit</Text>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </SurfaceContext.Provider>
  );
};

SurfaceRoot.displayName = 'SurfaceRoot';
export { SurfaceContext };
export default SurfaceRoot;
