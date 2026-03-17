// Wear OS Compose Target Interpreter — Kotlin @Composable with Wear material

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretWear(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'wear');
  const lines: string[] = [];

  lines.push(`import androidx.compose.runtime.*`);
  lines.push(`import androidx.compose.ui.Modifier`);
  lines.push(`import androidx.wear.compose.material.ScalingLazyColumn`);
  lines.push(`import androidx.wear.compose.material.Text`);
  lines.push(`import androidx.wear.compose.material.Chip`);
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

  // Send
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

  // Focus
  if (c.focusConfig) {
    lines.push(`    val focusRequester = remember { FocusRequester() }`);
    lines.push(`    LaunchedEffect(Unit) { focusRequester.requestFocus() }`);
    lines.push('');
  }

  // Modifier chain
  let modChain = 'modifier';
  if (c.keyboards.length > 0) {
    lines.push(`    val keyModifier = Modifier.onKeyEvent { event ->`);
    lines.push(`        when (event.key) {`);
    for (const kb of c.keyboards) {
      lines.push(`            Key.${ktKeyName(kb.key)} -> { send("${kb.event}"); true }`);
    }
    lines.push(`            else -> false`);
    lines.push(`        }`);
    lines.push(`    }`);
    modChain += '.then(keyModifier)';
  }
  if (c.focusConfig) modChain += '.focusRequester(focusRequester)';

  // Semantics
  const rootAria = c.ariaMap.get(c.elements[0]?.part || 'root') || [];
  const label = rootAria.find(a => a.attr === 'label' || a.attr === 'aria-label');
  if (label) modChain += `.semantics { contentDescription = "${label.value}" }`;

  // Layout — Wear uses ScalingLazyColumn
  lines.push(`    ScalingLazyColumn(modifier = ${modChain}) {`);
  for (const el of c.elements) {
    lines.push(`        item {`);
    lines.push(`            // ${el.part} (${el.role})`);
    lines.push(`            Text("TODO: ${el.part}")`);
    lines.push(`        }`);
  }
  for (const comp of c.composes) {
    lines.push(`        item { /* TODO: ${comp.widget} — slot: ${comp.slot} */ }`);
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
  return 'Any';
}
function ktDefault(v: string, t: string): string {
  if (t.toLowerCase() === 'string') return `"${v}"`;
  if (v === 'true' || v === 'false' || /^\d+$/.test(v)) return v;
  if (v === '[]') return 'emptyList()';
  return `"${v}"`;
}
function ktKeyName(key: string): string {
  if (key === 'Enter') return 'Enter';
  if (key === 'Escape') return 'Escape';
  if (key === 'Tab') return 'Tab';
  if (key === 'Space') return 'Spacebar';
  return key;
}
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
