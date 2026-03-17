// Vue 3 Target Interpreter — Single File Component with <script setup>

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, isExpression, capitalize, type FocusInfo } from './_classify.js';

export function interpretVue(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'vue');
  const script: string[] = [];
  const template: string[] = [];

  // --- Script setup ---
  script.push('<script setup lang="ts">');

  const imports: string[] = [];
  if (c.states.length > 0) imports.push('ref');
  if (c.focusConfig) imports.push('onMounted', 'ref as templateRef');
  if (imports.length > 0) script.push(`import { ${imports.join(', ')} } from 'vue';`);
  script.push('');

  // Props
  if (c.props.length > 0) {
    const propDefs = c.props.map(p => {
      const tsType = mapVueType(p.propType);
      const opt = p.defaultValue ? '?' : '';
      return `  ${p.name}${opt}: ${tsType};`;
    });
    script.push(`const props = defineProps<{`);
    script.push(...propDefs);
    script.push(`}>();`);

    // Defaults
    const withDefaults = c.props.filter(p => p.defaultValue);
    if (withDefaults.length > 0) {
      script.push(`const { ${withDefaults.map(p => `${p.name} = ${formatDefault(p.defaultValue, p.propType)}`).join(', ')} } = props;`);
    }
    script.push('');
  }

  // State
  const stateGroups = groupStates(c.states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const varName = group || 'state';
    script.push(`const ${varName} = ref('${initial.name}');`);
  }
  if (stateGroups.size > 0) script.push('');

  // Transitions
  if (c.transitions.length > 0) {
    script.push(`function send(event: string) {`);
    for (const [group] of stateGroups) {
      const varName = group || 'state';
      const groupTransitions = c.transitions.filter(t => {
        const prefix = group ? group + '.' : '';
        return t.fromState.startsWith(prefix) || (!group && !t.fromState.includes('.'));
      });
      if (groupTransitions.length > 0) {
        const byFrom = new Map<string, typeof groupTransitions>();
        for (const t of groupTransitions) {
          if (!byFrom.has(t.fromState)) byFrom.set(t.fromState, []);
          byFrom.get(t.fromState)!.push(t);
        }
        script.push(`  switch (${varName}.value) {`);
        for (const [from, trans] of byFrom) {
          script.push(`    case '${from}':`);
          for (const t of trans) {
            script.push(`      if (event === '${t.event}') { ${varName}.value = '${t.toState}'; return; }`);
          }
          script.push(`      break;`);
        }
        script.push(`  }`);
      }
    }
    script.push(`}`);
    script.push('');
  }

  // Keyboard
  if (c.keyboards.length > 0) {
    script.push(`function handleKeyDown(e: KeyboardEvent) {`);
    script.push(`  switch (e.key) {`);
    for (const kb of c.keyboards) {
      if (kb.key.includes('+')) {
        const [mod, k] = kb.key.split('+');
        script.push(`    case '${k}':`);
        script.push(`      if (e.${mod.toLowerCase()}Key) { send('${kb.event}'); e.preventDefault(); }`);
        script.push(`      break;`);
      } else {
        script.push(`    case '${kb.key}': send('${kb.event}'); e.preventDefault(); break;`);
      }
    }
    script.push(`  }`);
    script.push(`}`);
    script.push('');
  }

  // Focus
  if (c.focusConfig) {
    script.push(`const ${c.focusConfig.initialPart}Ref = templateRef<HTMLDivElement>();`);
    script.push(`onMounted(() => ${c.focusConfig.initialPart}Ref.value?.focus());`);
    script.push('');
  }

  script.push('</script>');

  // --- Template ---
  template.push('');
  template.push('<template>');
  for (const el of c.elements) {
    const attrs: string[] = [];
    attrs.push(`data-part="${el.part}"`);
    attrs.push(`data-role="${el.role}"`);

    const ariaAttrs = c.ariaMap.get(el.part) || [];
    for (const a of ariaAttrs) {
      if (isExpression(a.value)) {
        attrs.push(`:${a.attr}="/* ${a.value} */"`);
      } else {
        attrs.push(`${a.attr}="${a.value}"`);
      }
    }

    const binds = c.bindMap.get(el.part) || [];
    for (const b of binds) {
      if (b.attr === 'onClick' || b.attr.startsWith('on')) {
        if (b.expr.includes('send')) {
          const m = b.expr.match(/send\s*\(\s*(\w+)\s*\)/);
          const event = m ? m[1] : b.expr;
          attrs.push(`@click="send('${event}')"`);
        }
      } else if (isExpression(b.expr)) {
        attrs.push(`:${b.attr}="/* ${b.expr} */"`);
      } else {
        attrs.push(`${b.attr}="${b.expr}"`);
      }
    }

    if (c.keyboards.length > 0 && el === c.elements[0]) {
      attrs.push(`@keydown="handleKeyDown"`);
    }
    if (c.focusConfig && el.part === c.focusConfig.initialPart) {
      attrs.push(`ref="${el.part}Ref"`);
      attrs.push(`tabindex="0"`);
    }

    template.push(`  <div ${attrs.join(' ')}>`);
    template.push(`    <!-- TODO: ${el.part} (${el.role}) visual content -->`);
    template.push(`  </div>`);
  }

  for (const comp of c.composes) {
    template.push(`  <!-- <${capitalize(comp.widget)} /> — slot: ${comp.slot} -->`);
  }

  template.push('</template>');

  return { output: [...script, ...template].join('\n'), trace: c.trace };
}

function mapVueType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'string') return 'string';
  if (lower === 'bool' || lower === 'boolean') return 'boolean';
  if (lower === 'int' || lower === 'number') return 'number';
  if (lower.startsWith('list ')) return `${mapVueType(t.slice(5))}[]`;
  if (lower.startsWith('option ')) return `${mapVueType(t.slice(7))} | undefined`;
  if (lower.startsWith('union ')) return t.slice(6).split('|').map(v => `'${v.trim()}'`).join(' | ');
  return t;
}

function formatDefault(val: string, type: string): string {
  if (val === '[]') return '[]';
  if (val === 'true' || val === 'false') return val;
  if (/^\d+$/.test(val)) return val;
  return `'${val}'`;
}
