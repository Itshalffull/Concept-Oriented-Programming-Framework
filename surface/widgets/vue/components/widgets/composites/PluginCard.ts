// ============================================================
// PluginCard -- Vue 3 Component
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

export interface PluginCardProps {
  pluginId: string;
  pluginName: string;
  authorName: string;
  versionString?: string;
  descriptionText: string;
  ratingValue?: number;
  ratingCount?: number;
  installCountValue?: number;
  tags?: string[];
  iconUrl?: string;
  state?: 'available' | 'installed' | 'enabled';
  progress?: number;
  disabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  renderIcon?: () => VNode | string;
}

export const PluginCard = defineComponent({
  name: 'PluginCard',

  props: {
    pluginId: { type: String, required: true as const },
    pluginName: { type: String, required: true as const },
    authorName: { type: String, required: true as const },
    versionString: { type: String },
    descriptionText: { type: String, required: true as const },
    ratingValue: { type: Number },
    ratingCount: { type: Number },
    installCountValue: { type: Number },
    tags: { type: Array as PropType<any[]>, default: () => ([]) },
    iconUrl: { type: String },
    state: { type: String, default: 'available' },
    progress: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    onInstall: { type: Function as PropType<(...args: any[]) => any> },
    onUninstall: { type: Function as PropType<(...args: any[]) => any> },
    onEnable: { type: Function as PropType<(...args: any[]) => any> },
    onDisable: { type: Function as PropType<(...args: any[]) => any> },
    renderIcon: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['install', 'enable', 'disable'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ lifecycle: props.state, hover: 'idle', focus: 'unfocused', });
    const send = (action: any) => { /* state machine dispatch */ };
    const isTransitioning = state.value.lifecycle === 'installing' || state.value.lifecycle === 'uninstalling';

    return (): VNode =>
      h('div', {
        'role': 'article',
        'aria-label': props.pluginName,
        'aria-describedby': descriptionId,
        'data-surface-widget': '',
        'data-widget-name': 'plugin-card',
        'data-part': 'root',
        'data-state': state.value.lifecycle,
        'data-hovered': state.value.hover === 'hovered' ? 'true' : 'false',
        'tabindex': 0,
        'onPointerEnter': () => send({ type: 'POINTER_ENTER' }),
        'onPointerLeave': () => send({ type: 'POINTER_LEAVE' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
      }, [
        h('div', {
          'data-part': 'icon',
          'data-has-image': props.iconUrl ? 'true' : 'false',
          'aria-hidden': 'true',
        }, [
          props.renderIcon ? props.renderIcon() : props.iconUrl ? <img src={props.iconUrl} alt="" /> : null,
        ]),
        h('span', { 'data-part': 'name', 'id': nameId }, [
          props.pluginName,
        ]),
        h('span', { 'data-part': 'author' }, [
          props.authorName,
        ]),
        props.versionString ? h('span', { 'data-part': 'version' }, [
            'v',
            props.versionString,
          ]) : null,
        h('p', { 'data-part': 'description', 'id': descriptionId }, [
          props.descriptionText,
        ]),
        props.ratingValue != null ? h('div', { 'data-part': 'rating', 'aria-label': `${ratingValue} out of 5 stars` }, [
            '\u2605'.repeat(Math.round(props.ratingValue)),
            '\u2606'.repeat(5 - Math.round(props.ratingValue)),
            props.ratingCount != null ? h('span', { 'data-part': 'rating-count', 'aria-hidden': 'true' }, [
                '(',
                props.ratingCount,
                ')',
              ]) : null,
          ]) : null,
        props.installCountValue != null ? h('span', { 'data-part': 'install-count', 'aria-label': `${installCountValue} installs` }, [
            formatNumber(props.installCountValue),
            'installs',
          ]) : null,
        props.tags.length > 0 ? h('div', { 'data-part': 'tags', 'aria-label': 'Plugin tags' }, [
            ...props.tags.map((tag) => h('span', { 'data-part': 'tag' }, [
                tag,
              ])),
          ]) : null,
        h('span', {
          'data-part': 'status-badge',
          'data-state': state.value.lifecycle,
          'aria-label': `Status: ${statusText.toLowerCase()}`,
        }, [
          statusText,
        ]),
        isTransitioning ? h('div', {
            'role': 'progressbar',
            'aria-label': 'Installation progress',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': props.progress,
            'data-part': 'progress-bar',
            'data-progress': props.progress,
          }) : null,
        h('button', {
          'type': 'button',
          'data-part': 'install-button',
          'data-state': actionDataState,
          'aria-label': actionAriaLabel,
          'aria-disabled': isTransitioning || props.disabled ? 'true' : 'false',
          'disabled': isTransitioning || props.disabled,
          'onClick': handleAction,
        }, [
          buttonLabel(state.value.lifecycle),
        ]),
        h('button', {
          'type': 'button',
          'data-part': 'more-button',
          'aria-haspopup': 'menu',
          'aria-label': `More options for ${pluginName}`,
        }, '...'),
        slots.default?.(),
      ]);
  },
});

export default PluginCard;