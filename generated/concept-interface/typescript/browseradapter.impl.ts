// generated: browseradapter.impl.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// Browser platform mapping:
// Navigation -> pushState/replaceState with URL pattern
// Zones -> DOM layout regions (main content, sidebar, notification area)
// Overlays -> portal div insertion
// Events -> popstate, hashchange -> Navigator/back
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const type = (props.type as string) ?? '';

  if (type === 'navigation') {
    const destination = props.destination as string;
    const urlPattern = (props.urlPattern as string) ?? `/${destination}`;
    const params = (props.params as Record<string, unknown>) ?? {};

    // Resolve URL from pattern
    let url = urlPattern;
    for (const [k, v] of Object.entries(params)) {
      url = url.replace(`:${k}`, String(v));
    }

    result['action'] = 'pushState';
    result['url'] = url;
    result['destination'] = destination;
    result['historyState'] = { destination, params };

  } else if (type === 'replace') {
    const destination = props.destination as string;
    const urlPattern = (props.urlPattern as string) ?? `/${destination}`;
    result['action'] = 'replaceState';
    result['url'] = urlPattern;
    result['destination'] = destination;

  } else if (type === 'zone') {
    const role = (props.role as string) ?? 'navigated';
    const zone = (props.zone as string) ?? 'primary';

    const zoneMap: Record<string, string> = {
      navigated: 'main-content',
      persistent: 'sidebar',
      transient: 'notification-area',
    };

    result['action'] = 'mountZone';
    result['domTarget'] = zoneMap[role] ?? 'main-content';
    result['zone'] = zone;
    result['role'] = role;

  } else if (type === 'overlay') {
    result['action'] = 'createPortal';
    result['overlay'] = props.overlay ?? 'modal';
    result['portalId'] = `portal-${props.overlay ?? 'default'}`;
    result['backdrop'] = true;

  } else if (type === 'event') {
    const eventType = (props.event as string) ?? '';
    if (eventType === 'popstate' || eventType === 'hashchange') {
      result['action'] = 'navigateBack';
      result['source'] = eventType;
    } else {
      result['action'] = 'ignored';
      result['event'] = eventType;
    }

  } else {
    // Pass through other props
    for (const [key, value] of Object.entries(props)) {
      result[key] = value;
    }
  }

  result['platform'] = 'browser';
  return result;
}

export const browseradapterHandler: ConceptHandler = {
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
