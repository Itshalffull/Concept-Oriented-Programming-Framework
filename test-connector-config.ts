import {parseWidgetFile} from './handlers/ts/framework/widget-spec-parser';
import fs from 'fs';
const src = fs.readFileSync('surface/widgets/connector-config.widget', 'utf8');
let m: any;
try {
  m = parseWidgetFile(src);
  process.stderr.write('parsed ok\n');
} catch(e: any) {
  process.stderr.write('PARSE ERROR: ' + e.message + '\n');
  process.exit(1);
}
const n = (m.invariants||[]).length;
const c: any = {};
(m.invariants||[]).forEach((i: any) => c[i.kind] = (c[i.kind]||0)+1);
process.stderr.write('total: ' + n + ' by-kind: ' + JSON.stringify(c) + '\n');
process.stderr.write('anatomy: ' + (m.anatomy||[]).map((p:any) => p.name).join(', ') + '\n');
process.stderr.write('states: ' + JSON.stringify(m.states?.length || 'none') + '\n');
if (n < 10) { process.stderr.write('FAIL: invariant count ' + n + ' < 10\n'); process.exit(1); }
process.stderr.write('PASS\n');
