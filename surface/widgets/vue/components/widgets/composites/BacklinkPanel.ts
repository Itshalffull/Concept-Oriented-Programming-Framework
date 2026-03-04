// ============================================================
// BacklinkPanel -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface LinkedRef {
  sourceId: string;
  sourceTitle: string;
  sourcePath: string[];
  contextSnippet: string;
  highlightRange?: { start: number; end: number };
}

export interface UnlinkedRef {
  sourceId: string;
  sourceTitle: string;
  mentionId: string;
  contextSnippet: string;
}

export interface BacklinkPanelProps {
  targetId: string;
  targetTitle: string;
  linkedReferences?: LinkedRef[];
  unlinkedMentions?: UnlinkedRef[];
  loading?: boolean;
  showUnlinked?: boolean;
  contextChars?: number;
  onNavigate?: (sourceId: string) => void;
  onLink?: (sourceId: string, mentionId: string) => void;
}

export const BacklinkPanel = defineComponent({
  name: 'BacklinkPanel',

  props: {
    targetId: { type: String, required: true as const },
    targetTitle: { type: String, required: true as const },
    linkedReferences: { type: Array as PropType<any[]>, default: () => ([]) },
    unlinkedMentions: { type: Array as PropType<any[]>, default: () => ([]) },
    loading: { type: Boolean, default: false },
    showUnlinked: { type: Boolean, default: true },
    contextChars: { type: Number, default: 200 },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    onLink: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['navigate', 'link'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ panel: 'expanded', linkedSection: 'expanded', unlinkedSection: 'collapsed', loading: props.loading ? 'loading' : 'idle', });
    const send = (action: any) => { /* state machine dispatch */ };
    const totalCount = props.linkedReferences.length + props.unlinkedMentions.length;
    const isEmpty = props.linkedReferences.length === 0 && props.unlinkedMentions.length === 0 && !props.loading;

    return (): VNode =>
      h('div', {
        'role': 'complementary',
        'aria-label': `Backlinks to ${targetTitle}`,
        'aria-busy': props.loading ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'backlink-panel',
        'data-part': 'root',
        'data-state': state.value.panel,
      }, [
        h('div', { 'data-part': 'header', 'data-state': state.value.panel }, [
          h('span', { 'data-part': 'title', 'id': titleId }, 'Backlinks'),
          h('span', { 'data-part': 'count', 'aria-label': `${linkedReferences.length} linked, ${unlinkedMentions.length} unlinked` }, [
            totalCount,
          ]),
          h('button', {
            'type': 'button',
            'data-part': 'collapse-toggle',
            'aria-expanded': state.value.panel === 'expanded' ? 'true' : 'false',
            'aria-controls': panelContentId,
            'aria-label': state.value.panel === 'expanded' ? 'Collapse backlinks' : 'Expand backlinks',
            'onClick': () =>
              send({ type: state.value.panel === 'expanded' ? 'COLLAPSE' : 'EXPAND' }),
          }, [
            state.value.panel === 'expanded' ? '\u25B2' : '\u25BC',
          ]),
        ]),
        h('div', { 'id': panelContentId }, [
          state.value.panel === 'expanded' ? h('div', {
              'role': 'region',
              'aria-label': 'Linked mentions',
              'aria-expanded': state.value.linkedSection === 'expanded' ? 'true' : 'false',
              'data-part': 'linked-section',
              'data-state': state.value.linkedSection,
            }, [
              h('div', { 'data-part': 'linked-section-header', 'onClick': () =>
                  send({
                    type:
                      state.value.linkedSection === 'expanded'
                        ? 'COLLAPSE_LINKED'
                        : 'EXPAND_LINKED',
                  }) }, [
                h('span', { 'data-part': 'linked-section-label' }, 'Linked mentions'),
                h('span', { 'data-part': 'linked-section-count', 'aria-hidden': 'true' }, [
                  props.linkedReferences.length,
                ]),
              ]),
              state.value.linkedSection === 'expanded' ? h('div', {
                  'role': 'list',
                  'aria-label': 'Linked references',
                  'data-part': 'linked-list',
                  'data-count': props.linkedReferences.length,
                }, [
                  props.linkedReferences.map((item) => (
                    <div
                      key={`${item.sourceId}-linked`}
                      role="listitem"
                      aria-label={`Reference from ${item.sourceTitle}`}
                      data-part="linked-item"
                      data-source={item.sourceId}
                      tabIndex={0}
                      onClick={() => handleNavigate(item.sourceId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNavigate(item.sourceId);
                      }}
                    >
                      <nav data-part="linked-item-breadcrumb">
                        {item.sourcePath.map((segment, i) => (
                          <span key={i}>
                            {i > 0 && <span aria-hidden="true"> / </span>}
                            {segment}
                          </span>
                        ))}
                      </nav>
                      <span data-part="linked-item-context">
                        {truncate(item.contextSnippet)}
                      </span>
                      {item.highlightRange ? h('span', { 'data-part': 'linked-item-highlight', 'aria-hidden': 'true' }) : null,
                ]) : null,
            ]) : null,
          state.value.panel === 'expanded' && props.showUnlinked ? h('div', {
              'role': 'region',
              'aria-label': 'Unlinked mentions',
              'aria-expanded': state.value.unlinkedSection === 'expanded' ? 'true' : 'false',
              'data-part': 'unlinked-section',
              'data-state': state.value.unlinkedSection,
            }, [
              h('div', { 'data-part': 'unlinked-section-header', 'onClick': () =>
                  send({
                    type:
                      state.value.unlinkedSection === 'expanded'
                        ? 'COLLAPSE_UNLINKED'
                        : 'EXPAND_UNLINKED',
                  }) }, [
                h('span', { 'data-part': 'unlinked-section-label' }, 'Unlinked mentions'),
                h('span', { 'data-part': 'unlinked-section-count', 'aria-hidden': 'true' }, [
                  props.unlinkedMentions.length,
                ]),
              ]),
              state.value.unlinkedSection === 'expanded' ? h('div', {
                  'role': 'list',
                  'aria-label': 'Unlinked references',
                  'data-part': 'unlinked-list',
                  'data-count': props.unlinkedMentions.length,
                }, [
                  ...props.unlinkedMentions.map((item) => h('div', {
                      'role': 'listitem',
                      'aria-label': `Unlinked mention from ${item.sourceTitle}`,
                      'data-part': 'unlinked-item',
                      'data-source': item.sourceId,
                      'tabindex': 0,
                      'onClick': () => handleNavigate(item.sourceId),
                    }, [
                      h('span', { 'data-part': 'unlinked-item-context' }, [
                        truncate(item.contextSnippet),
                      ]),
                      h('button', {
                        'type': 'button',
                        'data-part': 'link-button',
                        'aria-label': `Link mention from ${item.sourceTitle}`,
                        'onClick': (e) => {
                          e.stopPropagation();
                          handleLink(item.sourceId, item.mentionId);
                        },
                      }, 'Link'),
                    ])),
                ]) : null,
            ]) : null,
          isEmpty ? h('div', { 'data-part': 'empty-state', 'aria-hidden': props.linkedReferences.length > 0 || props.unlinkedMentions.length > 0 ? 'true' : 'false' }, 'No backlinks found') : null,
        ]),
        slots.default?.(),
      ]);
  },
});
});)

export default BacklinkPanel;