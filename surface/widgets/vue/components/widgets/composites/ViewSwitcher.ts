// ============================================================
// ViewSwitcher -- Vue 3 Component
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

export interface ViewDef {
  id: string;
  name: string;
  type: ViewType;
  config?: Record<string, unknown>;
}

export type ViewType = 'table' | 'board' | 'calendar' | 'timeline' | 'gallery';

export interface ViewSwitcherProps {
  views: ViewDef[];
  activeView: string;
  availableTypes?: ViewType[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  allowRename?: boolean;
  allowDuplicate?: boolean;
  disabled?: boolean;
  onChange?: (views: ViewDef[], activeView: string) => void;
  renderContent?: (view: ViewDef) => VNode | string;
}

export const ViewSwitcher = defineComponent({
  name: 'ViewSwitcher',

  props: {
    views: { type: Array as PropType<any[]>, required: true as const },
    activeView: { type: String, required: true as const },
    availableTypes: { type: Array as PropType<any[]>, default: () => (['table', 'board', 'calendar', 'timeline', 'gallery']) },
    allowAdd: { type: Boolean, default: true },
    allowDelete: { type: Boolean, default: true },
    allowRename: { type: Boolean, default: true },
    allowDuplicate: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    onChange: { type: Array as PropType<any[]> },
    renderContent: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ menuOpen: false, configExpanded: false, renamingViewId: null, renameValue: '', });
    const send = (action: any) => { /* state machine dispatch */ };
    const activeViewDef = props.views.find((v) => v.id === props.activeView);

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': 'View switcher',
        'data-surface-widget': '',
        'data-widget-name': 'view-switcher',
        'data-part': 'root',
        'data-active-view': props.activeView,
        'data-disabled': props.disabled ? 'true' : 'false',
      }, [
        h('div', {
          'role': 'tablist',
          'aria-label': 'View modes',
          'aria-orientation': 'horizontal',
          'data-part': 'tab-bar',
          'data-active': props.activeView,
        }, [
          props.views.map((view) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              id={view.id === props.activeView ? activeTabId : undefined}
              aria-selected={view.id === props.activeView ? 'true' : 'false'}
              data-part="tab"
              data-view={view.id}
              data-type={view.type}
              tabIndex={view.id === props.activeView ? 0 : -1}
              props.disabled={props.disabled}
              onClick={() => handleSwitchView(view.id)}
              onDoubleClick={() =>
                props.allowRename && send({ type: 'START_RENAME', viewId: view.id, name: view.name })
              }
            >
              {state.value.renamingViewId === view.id
            ? h('input', {
              'type': 'text',
              'data-part': 'view-label',
              'data-editable': 'true',
              'data-state': 'editing',
              'value': state.value.renameValue,
              'onChange': (e) => send({ type: 'UPDATE_RENAME_VALUE', value: e.target.value }),
              'onBlur': handleCommitRename,
              'onKeyDown': (e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') send({ type: 'CANCEL_RENAME' });
                  },
              'autofocus': true,
            })
            : h('span', {
              'data-part': 'view-label',
              'data-editable': props.allowRename ? 'true' : 'false',
              'data-state': 'idle',
            }, [
              view.name,
            ]),
          props.allowAdd ? h('div', { 'data-part': 'add-view-wrapper' }, [
              h('button', {
                'type': 'button',
                'data-part': 'add-view-button',
                'aria-label': 'Add view',
                'aria-haspopup': 'menu',
                'aria-expanded': state.value.menuOpen ? 'true' : 'false',
                'aria-controls': menuId,
                'disabled': props.disabled || !props.allowAdd,
                'onClick': () => send({ type: state.value.menuOpen ? 'CLOSE_MENU' : 'OPEN_MENU' }),
              }, '+'),
              h('div', {
                'id': menuId,
                'role': 'menu',
                'aria-label': 'View types',
                'data-part': 'view-menu',
                'data-state': state.value.menuOpen ? 'open' : 'closed',
                'hidden': !state.value.menuOpen,
              }, [
                ...props.availableTypes.map((type) => h('button', {
                    'type': 'button',
                    'role': 'menuitem',
                    'data-part': 'view-menu-item',
                    'data-type': type,
                    'onClick': () => handleAddView(type),
                  }, [
                    type.charAt(0).toUpperCase() + type.slice(1),
                  ])),
              ]),
            ]) : null,
        ]),
        activeViewDef ? h('div', { 'data-part': 'view-actions' }, [
            props.allowDelete ? h('button', {
                'type': 'button',
                'data-part': 'delete-view-button',
                'aria-label': `Delete view ${activeViewDef.name}`,
                'disabled': props.disabled || !props.allowDelete || props.views.length <= 1,
                'onClick': () => handleDeleteView(props.activeView),
              }, 'Delete') : null,
            props.allowDuplicate ? h('button', {
                'type': 'button',
                'data-part': 'duplicate-button',
                'aria-label': `Duplicate view ${activeViewDef.name}`,
                'disabled': props.disabled || !props.allowDuplicate,
                'onClick': () => handleDuplicate(props.activeView),
              }, 'Duplicate') : null,
          ]) : null,
        h('div', {
          'role': 'tabpanel',
          'aria-labelledby': activeTabId,
          'data-part': 'content',
          'data-view-type': activeViewDef?.type,
          'data-state': 'active',
        }, [
          props.renderContent && activeViewDef ? props.renderContent(activeViewDef) : slots.default?.(),
        ]),
      ]);
  },
});
});)

export default ViewSwitcher;