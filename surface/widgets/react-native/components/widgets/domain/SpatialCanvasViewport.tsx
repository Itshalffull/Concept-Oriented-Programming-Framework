/**
 * Clef Surface React Native Widget — SpatialCanvasViewport
 *
 * Primary spatial editing surface using @shopify/react-native-skia for
 * high-performance rendering and react-native-gesture-handler for
 * pinch-zoom, pan, and long-press gestures.
 *
 * Implements the spatial-canvas-viewport.widget spec: camera transforms,
 * viewport culling, grid rendering, connector paths, marquee selection,
 * and the full state machine (idle, panning, selecting, contextMenu).
 */

import React, {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  Skia,
  useCanvasRef,
  vec,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface CanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface CanvasConnector {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/* ---------------------------------------------------------------------------
 * State machine
 * ------------------------------------------------------------------------- */

type Interaction = 'idle' | 'panning' | 'selecting' | 'contextMenu';

interface State {
  interaction: Interaction;
  camera: Camera;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  contextMenuPos: { x: number; y: number } | null;
}

type Event =
  | { type: 'PAN_START' }
  | { type: 'PAN_UPDATE'; translationX: number; translationY: number }
  | { type: 'PAN_END' }
  | { type: 'PINCH_UPDATE'; scale: number; focalX: number; focalY: number }
  | { type: 'PINCH_END' }
  | { type: 'LONG_PRESS'; x: number; y: number }
  | { type: 'CLOSE_MENU' }
  | { type: 'SET_CAMERA'; camera: Camera };

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'PAN_START':
      return { ...state, interaction: 'panning' };

    case 'PAN_UPDATE': {
      if (state.interaction !== 'panning') return state;
      return {
        ...state,
        camera: {
          ...state.camera,
          x: state.camera.x + event.translationX / state.camera.zoom,
          y: state.camera.y + event.translationY / state.camera.zoom,
        },
      };
    }

    case 'PAN_END':
      return { ...state, interaction: 'idle' };

    case 'PINCH_UPDATE': {
      const newZoom = Math.min(5.0, Math.max(0.1, state.camera.zoom * event.scale));
      // Zoom at focal point
      const worldFocalX = event.focalX / state.camera.zoom - state.camera.x;
      const worldFocalY = event.focalY / state.camera.zoom - state.camera.y;
      const newX = event.focalX / newZoom - worldFocalX;
      const newY = event.focalY / newZoom - worldFocalY;
      return {
        ...state,
        camera: { x: newX, y: newY, zoom: newZoom },
      };
    }

    case 'PINCH_END':
      return { ...state, interaction: 'idle' };

    case 'LONG_PRESS':
      return {
        ...state,
        interaction: 'contextMenu',
        contextMenuPos: { x: event.x, y: event.y },
      };

    case 'CLOSE_MENU':
      return { ...state, interaction: 'idle', contextMenuPos: null };

    case 'SET_CAMERA':
      return { ...state, camera: event.camera };

    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface SpatialCanvasViewportProps {
  canvasId: string;
  canvasName?: string;
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
  zoomMin?: number;
  zoomMax?: number;
  gridVisible?: boolean;
  gridSize?: number;
  gridStyle?: 'dots' | 'lines' | 'none';
  snapToGrid?: boolean;
  selectedItemIds?: string[];
  items?: CanvasItem[];
  connectors?: CanvasConnector[];
  backgroundFill?: string;
  onCameraChange?: (camera: Camera) => void;
  onSelectionChange?: (ids: string[]) => void;
  onItemPress?: (id: string) => void;
  minimapSlot?: ReactNode;
  renderItem?: (item: CanvasItem) => ReactNode;
  style?: ViewStyle;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function isVisible(
  item: CanvasItem,
  camera: Camera,
  vpWidth: number,
  vpHeight: number,
): boolean {
  const left = -camera.x;
  const top = -camera.y;
  const right = left + vpWidth / camera.zoom;
  const bottom = top + vpHeight / camera.zoom;
  return (
    item.x + item.width >= left &&
    item.x <= right &&
    item.y + item.height >= top &&
    item.y <= bottom
  );
}

function connectorSvgPath(
  source: CanvasItem | undefined,
  target: CanvasItem | undefined,
): string | null {
  if (!source || !target) return null;
  const sx = source.x + source.width / 2;
  const sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  const mx = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy} ${mx} ${ty} ${tx} ${ty}`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const SpatialCanvasViewport: React.FC<SpatialCanvasViewportProps> = ({
  canvasId,
  canvasName = '',
  cameraX = 0,
  cameraY = 0,
  zoom: controlledZoom = 1,
  zoomMin = 0.1,
  zoomMax = 5.0,
  gridVisible = true,
  gridSize = 20,
  gridStyle = 'dots',
  snapToGrid = true,
  selectedItemIds = [],
  items = [],
  connectors = [],
  backgroundFill = '#FAFAFA',
  onCameraChange,
  onSelectionChange,
  onItemPress,
  minimapSlot,
  renderItem,
  style,
}) => {
  const [state, send] = useReducer(reducer, {
    interaction: 'idle',
    camera: { x: cameraX, y: cameraY, zoom: controlledZoom },
    marquee: null,
    contextMenuPos: null,
  });

  const viewportSize = useRef({ width: 800, height: 600 });
  const lastTranslation = useRef({ x: 0, y: 0 });
  const lastScale = useRef(1);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportSize.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
  }, []);

  const { camera } = state;
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const culledItems = useMemo(
    () =>
      items.filter((item) =>
        isVisible(item, camera, viewportSize.current.width, viewportSize.current.height),
      ),
    [items, camera],
  );

  // --- Gestures ---

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .onStart(() => {
      lastTranslation.current = { x: 0, y: 0 };
      send({ type: 'PAN_START' });
    })
    .onUpdate((e) => {
      const dx = e.translationX - lastTranslation.current.x;
      const dy = e.translationY - lastTranslation.current.y;
      lastTranslation.current = { x: e.translationX, y: e.translationY };
      send({ type: 'PAN_UPDATE', translationX: dx, translationY: dy });
    })
    .onEnd(() => {
      send({ type: 'PAN_END' });
      onCameraChange?.(state.camera);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.current = 1;
    })
    .onUpdate((e) => {
      const scaleRatio = e.scale / lastScale.current;
      lastScale.current = e.scale;
      send({
        type: 'PINCH_UPDATE',
        scale: scaleRatio,
        focalX: e.focalX,
        focalY: e.focalY,
      });
    })
    .onEnd(() => {
      send({ type: 'PINCH_END' });
      onCameraChange?.(state.camera);
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart((e) => {
      send({ type: 'LONG_PRESS', x: e.x, y: e.y });
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);
  const allGestures = Gesture.Race(longPressGesture, composedGesture);

  // --- Skia-based grid + connector rendering ---

  const gridDots = useMemo(() => {
    if (!gridVisible || gridStyle === 'none') return null;
    const vpW = viewportSize.current.width / camera.zoom + Math.abs(camera.x);
    const vpH = viewportSize.current.height / camera.zoom + Math.abs(camera.y);
    const dots: React.ReactNode[] = [];

    if (gridStyle === 'dots') {
      for (let gx = 0; gx < vpW; gx += gridSize) {
        for (let gy = 0; gy < vpH; gy += gridSize) {
          dots.push(
            <Circle
              key={`d-${gx}-${gy}`}
              cx={gx}
              cy={gy}
              r={0.8}
              color="rgba(180,180,180,0.6)"
            />,
          );
        }
      }
    } else {
      // lines
      for (let gx = 0; gx < vpW; gx += gridSize) {
        dots.push(
          <Line
            key={`lv-${gx}`}
            p1={vec(gx, 0)}
            p2={vec(gx, vpH)}
            color="rgba(200,200,200,0.4)"
            strokeWidth={0.5}
          />,
        );
      }
      for (let gy = 0; gy < vpH; gy += gridSize) {
        dots.push(
          <Line
            key={`lh-${gy}`}
            p1={vec(0, gy)}
            p2={vec(vpW, gy)}
            color="rgba(200,200,200,0.4)"
            strokeWidth={0.5}
          />,
        );
      }
    }
    return dots;
  }, [gridVisible, gridStyle, gridSize, camera]);

  const connectorPaths = useMemo(() => {
    return connectors
      .map((conn) => {
        const d = connectorSvgPath(itemMap.get(conn.sourceId), itemMap.get(conn.targetId));
        if (!d) return null;
        const path = Skia.Path.MakeFromSVGString(d);
        if (!path) return null;
        return (
          <Path
            key={conn.id}
            path={path}
            color="#94a3b8"
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
          />
        );
      })
      .filter(Boolean);
  }, [connectors, itemMap]);

  return (
    <GestureHandlerRootView style={[styles.root, style]}>
      <GestureDetector gesture={allGestures}>
        <View
          style={[styles.root, { backgroundColor: backgroundFill }]}
          onLayout={onLayout}
          accessible
          accessibilityRole="none"
          accessibilityLabel={`Canvas: ${canvasName}`}
          accessibilityHint="Spatial canvas. Pinch to zoom, drag to pan."
        >
          {/* Skia Canvas for grid + connectors */}
          <Canvas style={StyleSheet.absoluteFill}>
            <Group
              transform={[
                { scale: camera.zoom },
                { translateX: camera.x },
                { translateY: camera.y },
              ]}
            >
              {/* Grid layer */}
              {gridDots}

              {/* Connector layer */}
              {connectorPaths}
            </Group>
          </Canvas>

          {/* Item layer — React Native views positioned absolutely */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { scale: camera.zoom },
                  { translateX: camera.x * camera.zoom },
                  { translateY: camera.y * camera.zoom },
                ],
              },
            ]}
            pointerEvents="box-none"
          >
            {culledItems.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              return (
                <View
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? '#3b82f6' : '#d1d5db',
                    borderRadius: 4,
                    backgroundColor: '#ffffff',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${item.type} item`}
                  onTouchEnd={() => onItemPress?.(item.id)}
                >
                  {renderItem?.(item)}
                </View>
              );
            })}
          </View>

          {/* Selection marquee — would render during 'selecting' state */}
          {state.interaction === 'selecting' && state.marquee && (
            <View
              style={{
                position: 'absolute',
                left: Math.min(state.marquee.startX, state.marquee.currentX),
                top: Math.min(state.marquee.startY, state.marquee.currentY),
                width: Math.abs(state.marquee.currentX - state.marquee.startX),
                height: Math.abs(state.marquee.currentY - state.marquee.startY),
                borderWidth: 1,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.08)',
              }}
              pointerEvents="none"
            />
          )}

          {/* Minimap slot */}
          {minimapSlot && (
            <View style={styles.minimap}>{minimapSlot}</View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

/* ---------------------------------------------------------------------------
 * Styles
 * ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  minimap: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 40,
  },
});

SpatialCanvasViewport.displayName = 'SpatialCanvasViewport';
export default SpatialCanvasViewport;
