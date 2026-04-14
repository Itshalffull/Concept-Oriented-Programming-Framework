import {parseWidgetFile} from '../handlers/ts/framework/widget-spec-parser';
import fs from 'fs';
const m:any=parseWidgetFile(fs.readFileSync('./surface/widgets/connector-call-log.widget','utf8'));
const n=(m.invariants||[]).length;
const c:any={};
(m.invariants||[]).forEach((i:any)=>c[i.kind]=(c[i.kind]||0)+1);
console.log('total:',n,'by-kind:',c);
if(n<10) { console.error('FAIL='+n); process.exit(1); }
console.log('PASS - invariants meet threshold');
