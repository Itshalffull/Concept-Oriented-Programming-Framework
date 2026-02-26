// generated: terminaladapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// Terminal platform mapping:
// Navigation -> screen buffer clear + render
// Zones -> main buffer (navigated), status line (persistent), transient ignored
// Overlays -> floating text box
// Events -> Escape -> Navigator/back
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const type = (props.type as string) ?? '';

  if (type === 'navigation') {
    const destination = props.destination as string;

    result['action'] = 'switchScreen';
    result['screen'] = destination;
    result['clearBuffer'] = true;
    result['render'] = true;

  } else if (type === 'replace') {
    result['action'] = 'switchScreen';
    result['screen'] = props.destination;
    result['clearBuffer'] = true;

  } else if (type === 'zone') {
    const role = (props.role as string) ?? 'navigated';
    const zone = (props.zone as string) ?? 'primary';

    const zoneMap: Record<string, string> = {
      navigated: 'main-buffer',
      persistent: 'status-line',
    };

    const target = zoneMap[role];
    if (target) {
      result['action'] = 'mountZone';
      result['terminalTarget'] = target;
      result['zone'] = zone;
      result['role'] = role;
    } else {
      // Terminal has no toast/notification equivalent
      result['action'] = 'skipped';
      result['reason'] = `Role "${role}" has no terminal equivalent`;
      result['zone'] = zone;
      result['role'] = role;
    }

  } else if (type === 'overlay') {
    result['action'] = 'floatingBox';
    result['overlay'] = props.overlay ?? 'dialog';
    result['border'] = 'single';
    result['focusTrap'] = true;

  } else if (type === 'event') {
    const eventType = (props.event as string) ?? '';
    if (eventType === 'escape') {
      result['action'] = 'navigateBack';
      result['source'] = 'escape';
    } else if (eventType === 'ctrl-c') {
      result['action'] = 'quit';
    } else {
      result['action'] = 'ignored';
      result['event'] = eventType;
    }

  } else {
    for (const [key, value] of Object.entries(props)) {
      result[key] = value;
    }
  }

  result['platform'] = 'terminal';
  return result;
}

export const terminaladapterHandler: ConceptHandler = {
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
