// generated: desktopadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// Desktop platform mapping:
// Navigation -> window focus/creation, multi-window management
// Zones -> main window (navigated), panel/sidebar (persistent), notification (transient)
// Overlays -> modal dialog
// Events -> Cmd+[/Alt+Left -> Navigator/back, window close -> cleanup
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const type = (props.type as string) ?? '';

  if (type === 'navigation') {
    const destination = props.destination as string;
    const windowConfig = (props.windowConfig as Record<string, unknown>) ?? {};
    const reuse = (windowConfig.reuse as boolean) ?? true;

    if (reuse) {
      result['action'] = 'focusWindow';
      result['window'] = destination;
    } else {
      result['action'] = 'createWindow';
      result['window'] = destination;
      result['width'] = windowConfig.width ?? 800;
      result['height'] = windowConfig.height ?? 600;
    }

    result['destination'] = destination;
    result['menubar'] = true;
    result['keyboardShortcuts'] = true;

  } else if (type === 'replace') {
    result['action'] = 'replaceContent';
    result['window'] = props.destination;

  } else if (type === 'zone') {
    const role = (props.role as string) ?? 'navigated';
    const zone = (props.zone as string) ?? 'primary';

    const zoneMap: Record<string, string> = {
      navigated: 'main-window',
      persistent: 'panel',
      transient: 'notification',
    };

    result['action'] = 'mountZone';
    result['desktopTarget'] = zoneMap[role] ?? 'main-window';
    result['zone'] = zone;
    result['role'] = role;

  } else if (type === 'overlay') {
    result['action'] = 'showDialog';
    result['overlay'] = props.overlay ?? 'modal';
    result['modal'] = true;
    result['escapeDismiss'] = true;

  } else if (type === 'event') {
    const eventType = (props.event as string) ?? '';
    if (eventType === 'cmd-[' || eventType === 'alt-left') {
      result['action'] = 'navigateBack';
      result['source'] = eventType;
    } else if (eventType === 'window-close') {
      result['action'] = 'cleanup';
      result['window'] = props.window ?? 'current';
    } else if (eventType === 'tray-click') {
      result['action'] = 'showFromTray';
    } else {
      result['action'] = 'ignored';
      result['event'] = eventType;
    }

  } else {
    for (const [key, value] of Object.entries(props)) {
      result[key] = value;
    }
  }

  result['platform'] = 'desktop';
  return result;
}

export const desktopadapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const propsStr = input.props as string;

    if (!propsStr || propsStr.trim() === '') {
      return { variant: 'error', message: 'Props string is empty' };
    }

    let props: Record<string, unknown>;
    try {
      props = JSON.parse(propsStr) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON in props string' };
    }

    const normalized = normalizeProps(props);
    const normalizedStr = JSON.stringify(normalized);

    await storage.put(RELATION, adapter, {
      adapter,
      outputs: normalizedStr,
    });

    return { variant: 'ok', adapter, normalized: normalizedStr };
  },
};
