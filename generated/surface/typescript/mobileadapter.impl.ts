// generated: mobileadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// Mobile platform mapping:
// Navigation -> React Navigation stack push/pop, tab switch
// Zones -> stack screen (navigated), bottom tab bar (persistent), toast (transient)
// Overlays -> modal sheet presentation
// Events -> hardware back, swipe-back -> Navigator/back
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const type = (props.type as string) ?? '';

  if (type === 'navigation') {
    const destination = props.destination as string;
    const stackBehavior = (props.stackBehavior as string) ?? 'push';
    const tabGroup = (props.tabGroup as string) ?? null;

    if (tabGroup) {
      result['action'] = 'switchTab';
      result['tab'] = tabGroup;
      result['screen'] = destination;
    } else if (stackBehavior === 'push') {
      result['action'] = 'navigation.push';
      result['screen'] = destination;
    } else if (stackBehavior === 'replace') {
      result['action'] = 'navigation.replace';
      result['screen'] = destination;
    } else if (stackBehavior === 'reset') {
      result['action'] = 'navigation.reset';
      result['screen'] = destination;
    }

    result['params'] = props.params ?? {};
    result['deepLink'] = props.deepLink ?? null;

  } else if (type === 'replace') {
    result['action'] = 'navigation.replace';
    result['screen'] = props.destination;

  } else if (type === 'zone') {
    const role = (props.role as string) ?? 'navigated';
    const zone = (props.zone as string) ?? 'primary';

    const zoneMap: Record<string, string> = {
      navigated: 'stack-screen',
      persistent: 'bottom-tab-bar',
      transient: 'toast',
    };

    result['action'] = 'mountZone';
    result['mobileTarget'] = zoneMap[role] ?? 'stack-screen';
    result['zone'] = zone;
    result['role'] = role;

  } else if (type === 'overlay') {
    result['action'] = 'presentModal';
    result['overlay'] = props.overlay ?? 'modal';
    result['presentation'] = 'modal-sheet';
    result['gestureEnabled'] = true;

  } else if (type === 'event') {
    const eventType = (props.event as string) ?? '';
    if (eventType === 'hardware-back' || eventType === 'swipe-back') {
      result['action'] = 'navigateBack';
      result['source'] = eventType;
    } else if (eventType === 'deep-link') {
      result['action'] = 'handleDeepLink';
      result['url'] = props.url ?? '';
    } else if (eventType === 'push-notification') {
      result['action'] = 'handleNotification';
      result['payload'] = props.payload ?? {};
    } else {
      result['action'] = 'ignored';
      result['event'] = eventType;
    }

  } else {
    for (const [key, value] of Object.entries(props)) {
      result[key] = value;
    }
  }

  result['platform'] = 'mobile';
  return result;
}

export const mobileadapterHandler: ConceptHandler = {
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
