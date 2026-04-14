import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser';
import { readFileSync } from 'fs';

const widgetPath = process.argv[2] || 'surface/widgets/automation-provider-dashboard.widget';
try {
  const m = parseWidgetFile(readFileSync(widgetPath, 'utf8'));
  const n = (m.invariants || []).length;
  const c: Record<string, number> = {};
  (m.invariants || []).forEach((i: any) => { c[i.kind] = (c[i.kind] || 0) + 1; });
  const msg = `invariants: ${n} by-kind: ${JSON.stringify(c)}`;
  const parts = `anatomy parts: ${m.anatomy.length} (${m.anatomy.map((p: any) => p.name).join(', ')})`;
  const states = `states: ${m.states.length} (${m.states.map((s: any) => s.name).join(', ')})`;
  process.stderr.write(msg + '\n');
  process.stderr.write(parts + '\n');
  process.stderr.write(states + '\n');
  if (n < 10) process.exit(1);
} catch(e: any) {
  process.stderr.write('PARSE ERROR: ' + e.message + '\n');
  process.exit(1);
}
