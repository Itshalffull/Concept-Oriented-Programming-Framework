import type {
  WidgetSpec,
  WidgetRegistry,
  WidgetInstance,
  MachineSpec,
} from './widget-spec';

import { registrationWidgetSpec } from './registration-widget';
import { loginWidgetSpec } from './login-widget';
import { articleEditorWidgetSpec } from './article-editor-widget';
import { articleViewWidgetSpec } from './article-view-widget';
import { commentWidgetSpec } from './comment-widget';
import { profileWidgetSpec } from './profile-widget';
import { feedWidgetSpec } from './feed-widget';
import { settingsWidgetSpec } from './settings-widget';

function createStateMachineInstance<T = Record<string, unknown>>(
  spec: WidgetSpec,
  machine: MachineSpec,
  initialContext?: Partial<T>,
): WidgetInstance<T> {
  const defaultContext = { ...machine.context, ...initialContext } as T;

  const instance: WidgetInstance<T> = {
    spec,
    state: machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = machine.states[instance.state];
      if (!currentState) return;

      const transition = currentState.on[event];
      if (!transition) return;

      if (payload) {
        Object.assign(instance.context as Record<string, unknown>, payload);
      }

      instance.state = transition.target;
    },

    getProps(part: string): Record<string, unknown> {
      return {
        'data-part': part,
        'data-state': instance.state,
        'data-widget': spec.name,
      };
    },

    destroy() {
      instance.state = machine.initial;
      Object.assign(
        instance.context as Record<string, unknown>,
        JSON.parse(JSON.stringify(defaultContext)),
      );
    },
  };

  return instance;
}

class ConduitWidgetRegistry implements WidgetRegistry {
  private readonly widgets = new Map<string, WidgetSpec>();

  register(spec: WidgetSpec): void {
    this.widgets.set(spec.name, spec);
  }

  get(name: string): WidgetSpec | undefined {
    return this.widgets.get(name);
  }

  list(category?: string): readonly WidgetSpec[] {
    const all = Array.from(this.widgets.values());
    if (!category) return all;
    return all.filter((spec) => spec.category === category);
  }

  createInstance<T = Record<string, unknown>>(
    name: string,
    initialContext?: Partial<T>,
  ): WidgetInstance<T> {
    const spec = this.widgets.get(name);
    if (!spec) {
      throw new Error(`Widget "${name}" is not registered`);
    }
    return createStateMachineInstance<T>(spec, spec.machine, initialContext);
  }
}

export function createConduitWidgetRegistry(): WidgetRegistry {
  const registry = new ConduitWidgetRegistry();

  registry.register(registrationWidgetSpec);
  registry.register(loginWidgetSpec);
  registry.register(articleEditorWidgetSpec);
  registry.register(articleViewWidgetSpec);
  registry.register(commentWidgetSpec);
  registry.register(profileWidgetSpec);
  registry.register(feedWidgetSpec);
  registry.register(settingsWidgetSpec);

  return registry;
}

export const conduitWidgetRegistry: WidgetRegistry = createConduitWidgetRegistry();
