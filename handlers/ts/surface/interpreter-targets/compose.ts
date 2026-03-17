// Jetpack Compose Target Interpreter — Kotlin @Composable functions

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretCompose(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'compose');
  const lines: string[] = [];

  lines.push(`import androidx.compose.runtime.*`);
  lines.push(`import androidx.compose.ui.Modifier`);
  lines.push(`import androidx.compose.foundation.layout.Column`);
  lines.push(`import androidx.compose.material3.Text`);
  if (c.keyboards.length > 0) {
    lines.push(`import androidx.compose.ui.input.key.onKeyEvent`);
    lines.push(`import androidx.compose.ui.input.key.Key`);
  }
  if (c.focusConfig) {
    lines.push(`import androidx.compose.ui.focus.FocusRequester`);
    lines.push(`import androidx.compose.ui.focus.focusRequester`);
  }
  if (c.ariaMap.size > 0) {
    lines.push(`import androidx.compose.ui.semantics.semantics`);
    lines.push(`import androidx.compose.ui.semantics.contentDescription`);
    lines.push(`import androidx.compose.ui.semantics.role`);
    lines.push(`import androidx.compose.ui.semantics.Role`);
  }
  lines.push('');

  // Function signature
  const params: string[] = [];
  for (const p of c.props) {
    const kt = ktType(p.propType);
    const def = p.defaultValue ? ` = ${ktDefault(p.defaultValue, p.propType)}` : '';
    params.push(`    ${p.name}: ${kt}${def}`);
  }
  params.push(`    modifier: Modifier = Modifier`);

  lines.push(`@Composable`);
  lines.push(`fun ${componentName}(`);
  lines.push(params.join(',\n'));
  lines.push(`) {`);

  // State
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`    var ${v} by remember { mutableStateOf("${initial.name}") }`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Send function
  if (c.transitions.length > 0) {
    lines.push(`    fun send(event: String) {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        const byFrom = groupBy(gt, t => t.fromState);
        lines.push(`        when (${v}) {`);
        for (const [from, trans] of byFrom) {
          for (const t of trans) {
            lines.push(`            "${from}" -> if (event == "${t.event}") ${v} = "${t.toState}"`);
          }
        }
        lines.push(`        }`);
      }
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Focus requester
  if (c.focusConfig) {
    lines.push(`    val focusRequester = remember { FocusRequester() }`);
    lines.push(`    LaunchedEffect(Unit) { focusRequester.requestFocus() }`);
    lines.push('');
  }

  // Build modifier chain
  let modChain = 'modifier';
  if (c.keyboards.length > 0) {
    lines.push(`    val keyModifier = Modifier.onKeyEvent { event ->`);
    lines.push(`        when (event.key) {`);
    for (const kb of c.keyboards) {
      const ktKey = ktKeyName(kb.key);
      lines.push(`            Key.${ktKey} -> { send("${kb.event}"); true }`);
    }
    lines.push(`            else -> false`);
    lines.push(`        }`);
    lines.push(`    }`);
    modChain += '.then(keyModifier)';
  }
  if (c.focusConfig) modChain += '.focusRequester(focusRequester)';

  // Semantics
  const rootAria = c.ariaMap.get(c.elements[0]?.part || 'root') || [];
  if (rootAria.length > 0) {
    const role = rootAria.find(a => a.attr === 'role');
    const label = rootAria.find(a => a.attr === 'label' || a.attr === 'aria-label');
    const semParts: string[] = [];
    if (role) semParts.push(`role = Role.${capitalize(role.value)}`);
    if (label) semParts.push(`contentDescription = "${label.value}"`);
    if (semParts.length > 0) modChain += `.semantics { ${semParts.join('; ')} }`;
  }

  // Layout
  lines.push(`    Column(modifier = ${modChain}) {`);
  for (const el of c.elements) {
    lines.push(`        // ${el.part} (${el.role})`);
    lines.push(`        Text("TODO: ${el.part}")`);
  }
  for (const comp of c.composes) {
    lines.push(`        // TODO: ${capitalize(comp.widget)} — slot: ${comp.slot}`);
  }
  lines.push(`    }`);
  lines.push('}');

  return { output: lines.join('\n'), trace: c.trace };
}

function ktType(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'String';
  if (l === 'bool' || l === 'boolean') return 'Boolean';
  if (l === 'int' || l === 'number' || l === 'integer') return 'Int';
  if (l.startsWith('list ')) return `List<${ktType(t.slice(5))}>`;
  return 'Any';
}

function ktDefault(v: string, t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return `"${v}"`;
  if (v === 'true' || v === 'false') return v;
  if (/^\d+$/.test(v)) return v;
  if (v === '[]') return 'emptyList()';
  return `"${v}"`;
}

function ktKeyName(key: string): string {
  if (key === 'Enter') return 'Enter';
  if (key === 'Escape') return 'Escape';
  if (key === 'Tab') return 'Tab';
  if (key === 'Space') return 'Spacebar';
  if (key === 'ArrowUp') return 'DirectionUp';
  if (key === 'ArrowDown') return 'DirectionDown';
  if (key === 'ArrowLeft') return 'DirectionLeft';
  if (key === 'ArrowRight') return 'DirectionRight';
  return key;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
