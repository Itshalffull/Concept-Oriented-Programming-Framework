// ============================================================
// DesktopAdapter Handler
//
// Transforms framework-neutral props into desktop application
// bindings: Electron/Tauri IPC channels, native window events.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const DESKTOP_IPC_MAP: Record<string, string> = {
  onclick: 'click',
  ondoubleclick: 'double-click',
  onchange: 'change',
  onsubmit: 'submit',
  onfocus: 'focus',
  onblur: 'blur',
  onkeydown: 'key-down',
  onkeyup: 'key-up',
  onclose: 'close',
  onminimize: 'minimize',
  onmaximize: 'maximize',
  onresize: 'resize',
  onmove: 'move',
  ondrag: 'drag',
  ondrop: 'drop',
};

export const desktopAdapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      return { variant: 'error', message: 'Props cannot be empty' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return { variant: 'error', message: 'Props must be valid JSON' };
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* pass through unchanged
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> desktop CSS class (webview-based renderers)
      if (key === 'class') {
        normalized['className'] = value;
        continue;
      }

      // Event handlers -> IPC channel bindings
      if (key.startsWith('on')) {
        const channel = DESKTOP_IPC_MAP[key.toLowerCase()];
        if (channel) {
          normalized[`ipc:${channel}`] = { ipc: { channel, handler: value } };
        } else {
          const eventName = key.slice(2).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          normalized[`ipc:${eventName}`] = { ipc: { channel: eventName, handler: value } };
        }
        continue;
      }

      // style -> desktop CSS/native style
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
