import { defineComponent, h, ref, computed, onBeforeUnmount, type PropType } from 'vue';

export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

export const ArtifactPanel = defineComponent({
  name: 'ArtifactPanel',
  props: {
    content: { type: String, required: true },
    artifactType: { type: String, required: true },
    title: { type: String, required: true },
    showVersions: { type: Boolean, default: true },
    defaultWidth: { type: String, default: '50%' },
    resizable: { type: Boolean, default: true },
    versions: { type: Array as PropType<string[]>, default: () => [] },
    currentVersion: { type: Number, default: 0 },
  },
  emits: ['copy', 'download', 'close', 'fullscreen', 'versionChange'],
  setup(props, { emit, slots }) {
    const state = ref<ArtifactPanelState>('open');
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    function send(event: ArtifactPanelEvent) {
      state.value = artifactPanelReducer(state.value, event);
    }

    onBeforeUnmount(() => { if (copyTimer) clearTimeout(copyTimer); });

    async function handleCopy() {
      try { await navigator.clipboard.writeText(props.content); } catch { /* noop */ }
      send({ type: 'COPY' });
      emit('copy');
      copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
    }

    function handleDownload() {
      const blob = new Blob([props.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${props.title}.${props.artifactType}`;
      a.click();
      URL.revokeObjectURL(url);
      emit('download');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (state.value === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
        else send({ type: 'CLOSE' }); emit('close');
      }
    }

    return () => {
      if (state.value === 'closed') {
        return h('div', {
          'data-surface-widget': '',
          'data-widget-name': 'artifact-panel',
          'data-part': 'root',
          'data-state': 'closed',
        }, [
          h('button', {
            type: 'button', 'data-part': 'open-button',
            onClick: () => send({ type: 'OPEN' }),
            'aria-label': 'Open artifact panel',
          }, 'Open'),
        ]);
      }

      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'title-text' }, props.title),
        h('div', { 'data-part': 'type-badge' }, props.artifactType),
        h('div', { 'data-part': 'toolbar' }, [
          h('button', {
            type: 'button', 'data-part': 'copy-button',
            'aria-label': state.value === 'copied' ? 'Copied!' : 'Copy content',
            onClick: handleCopy,
          }, state.value === 'copied' ? 'Copied!' : 'Copy'),
          h('button', {
            type: 'button', 'data-part': 'download-button',
            'aria-label': 'Download artifact',
            onClick: handleDownload,
          }, 'Download'),
          h('button', {
            type: 'button', 'data-part': 'fullscreen-button',
            'aria-label': state.value === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen',
            onClick: () => send({ type: state.value === 'fullscreen' ? 'EXIT_FULLSCREEN' : 'FULLSCREEN' }),
          }, state.value === 'fullscreen' ? 'Exit' : 'Fullscreen'),
          h('button', {
            type: 'button', 'data-part': 'close-button',
            'aria-label': 'Close panel',
            onClick: () => { send({ type: 'CLOSE' }); emit('close'); },
          }, '\u2715'),
        ]),
      ]));

      // Content area
      if (props.artifactType === 'code') {
        children.push(h('pre', { 'data-part': 'content-area', 'data-type': 'code' }, [
          h('code', {}, props.content),
        ]));
      } else {
        children.push(h('div', {
          'data-part': 'content-area',
          'data-type': props.artifactType,
        }, slots.default ? slots.default() : props.content));
      }

      // Version bar
      if (props.showVersions && props.versions.length > 1) {
        children.push(h('div', { 'data-part': 'version-bar' }, [
          h('button', {
            type: 'button', 'data-part': 'version-prev',
            disabled: props.currentVersion <= 0,
            onClick: () => { emit('versionChange', props.currentVersion - 1); send({ type: 'VERSION_CHANGE' }); },
            'aria-label': 'Previous version',
          }, '\u2190'),
          h('span', { 'data-part': 'version-label' }, `v${props.currentVersion + 1} of ${props.versions.length}`),
          h('button', {
            type: 'button', 'data-part': 'version-next',
            disabled: props.currentVersion >= props.versions.length - 1,
            onClick: () => { emit('versionChange', props.currentVersion + 1); send({ type: 'VERSION_CHANGE' }); },
            'aria-label': 'Next version',
          }, '\u2192'),
        ]));
      }

      return h('div', {
        role: 'complementary',
        'aria-label': `Artifact: ${props.title}`,
        'data-surface-widget': '',
        'data-widget-name': 'artifact-panel',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
        style: { width: state.value === 'fullscreen' ? '100%' : props.defaultWidth },
      }, children);
    };
  },
});

export default ArtifactPanel;
