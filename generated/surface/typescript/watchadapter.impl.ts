// generated: watchadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// Watch platform mapping:
// Navigation -> single-focus full-screen page push
// Zones -> only "navigated" mapped to full screen; persistent/transient silently skipped
// Overlays -> haptic alert
// Events -> crown press -> Navigator/back
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const type = (props.type as string) ?? '';

  if (type === 'navigation') {
    const destination = props.destination as string;

    result['action'] = 'pushPage';
    result['page'] = destination;
    result['fullScreen'] = true;
    result['autoSave'] = true;
    result['hapticFeedback'] = 'selection';

  } else if (type === 'replace') {
    result['action'] = 'replacePage';
    result['page'] = props.destination;
    result['autoSave'] = true;

  } else if (type === 'zone') {
    const role = (props.role as string) ?? 'navigated';
    const zone = (props.zone as string) ?? 'primary';

    if (role === 'navigated') {
      result['action'] = 'mountZone';
      result['watchTarget'] = 'full-screen';
      result['zone'] = zone;
      result['role'] = role;
    } else {
      // Watch only supports one zone — silently skip persistent/transient
      result['action'] = 'skipped';
      result['reason'] = `Role "${role}" has no watch equivalent`;
      result['zone'] = zone;
      result['role'] = role;
    }

  } else if (type === 'overlay') {
    result['action'] = 'hapticAlert';
    result['overlay'] = props.overlay ?? 'alert';
    result['hapticType'] = 'notification';
    result['alertStyle'] = 'compact';

  } else if (type === 'event') {
    const eventType = (props.event as string) ?? '';
    if (eventType === 'crown-press') {
      result['action'] = 'navigateBack';
      result['source'] = 'crown-press';
    } else if (eventType === 'crown-rotate') {
      result['action'] = 'scroll';
      result['source'] = 'digital-crown';
    } else if (eventType === 'wrist-raise') {
      result['action'] = 'activate';
    } else {
      result['action'] = 'ignored';
      result['event'] = eventType;
    }

  } else {
    for (const [key, value] of Object.entries(props)) {
      result[key] = value;
    }
  }

  result['platform'] = 'watch';
  return result;
}

export const watchadapterHandler: ConceptHandler = {
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
