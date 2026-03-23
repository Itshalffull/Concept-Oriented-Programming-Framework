// @clef-handler style=imperative
// VerificationRun Concept Implementation — Formal Verification Suite
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, merge, branch, completeFrom,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';
const RELATION = 'verification-runs';
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { const chr = str.charCodeAt(i); hash = ((hash << 5) - hash) + chr; hash |= 0; }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}
type Result = { variant: string; [key: string]: unknown };
export const verificationRunHandler: FunctionalConceptHandler = {
  start(input) {
    const target_symbol = input.target_symbol as string || input.name as string || '';
    const rawProps = input.properties || input.property_ids;
    let propertyList: string[];
    if (Array.isArray(rawProps)) { propertyList = rawProps as string[]; }
    else if (typeof rawProps === 'string') {
      try { propertyList = JSON.parse(rawProps as string); } catch {
        return complete(createProgram(), 'invalid', { message: 'properties must be a valid array' }) as StorageProgram<Result>;
      }
    } else { propertyList = []; }
    if (propertyList.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'properties must be a non-empty array' }) as StorageProgram<Result>;
    }
    const solver = input.solver as string || input.solver_provider as string || 'auto';
    const timeout_ms = input.timeout_ms as number || 300000;
    const id = `vr-${simpleHash(target_symbol + ':' + Date.now().toString())}`;
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, RELATION, id, {
      id, target_symbol, status: 'running', properties: JSON.stringify(propertyList),
      total_count: propertyList.length, results: JSON.stringify({}),
      partial_results: JSON.stringify({}), resource_usage: JSON.stringify({}),
      solver, timeout_ms, started_at: now, ended_at: '',
    });
    return complete(p, 'ok', { run: id, id, target_symbol, status: 'running', total_count: propertyList.length, started_at: now }) as StorageProgram<Result>;
  },
  complete(input) {
    const id = (input.run || input.id) as string;
    const results = input.results as string;
    const resource_usage = input.resource_usage as string;
    let resultsMap: Record<string, string>;
    try { resultsMap = JSON.parse(results); } catch {
      return complete(createProgram(), 'invalid', { message: 'results must be valid JSON' }) as StorageProgram<Result>;
    }
    let proved = 0, refuted = 0, unknown = 0;
    for (const s of Object.values(resultsMap)) { if (s === 'proved') proved++; else if (s === 'refuted') refuted++; else unknown++; }
    const now = new Date().toISOString();
    let p = createProgram();
    p = get(p, RELATION, id, 'rec');
    return branch(p, 'rec',
      (b) => { const b2 = merge(b, RELATION, id, { status: 'completed', results: JSON.stringify(resultsMap), resource_usage: resource_usage || '', ended_at: now }); return complete(b2, 'ok', { run: id, id, status: 'completed', proved, refuted, unknown, ended_at: now }); },
      (b) => complete(b, 'notfound', { run: id, id }),
    ) as StorageProgram<Result>;
  },
  timeout(input) {
    const id = (input.run || input.id) as string;
    const partial_results = input.partial_results as string;
    let partialMap: Record<string, string>;
    try { partialMap = JSON.parse(partial_results); } catch { partialMap = {}; }
    const completedCount = Object.keys(partialMap).length;
    const now = new Date().toISOString();
    let p = createProgram();
    p = get(p, RELATION, id, 'rec');
    return branch(p, 'rec',
      (b) => { const b2 = merge(b, RELATION, id, { status: 'timeout', partial_results: JSON.stringify(partialMap), ended_at: now }); return completeFrom(b2, 'ok', (bindings) => { const run = bindings.rec as Record<string, unknown>; const tc = run.total_count as number; return { run: id, id, status: 'timeout', completed_count: completedCount, remaining_count: tc - completedCount, total_count: tc, ended_at: now }; }); },
      (b) => complete(b, 'notfound', { run: id, id }),
    ) as StorageProgram<Result>;
  },
  cancel(input) {
    const id = (input.run || input.id) as string;
    const now = new Date().toISOString();
    let p = createProgram();
    p = get(p, RELATION, id, 'rec');
    return branch(p, 'rec',
      (b) => { const b2 = merge(b, RELATION, id, { status: 'cancelled', ended_at: now }); return complete(b2, 'ok', { run: id, id, status: 'cancelled', ended_at: now }); },
      (b) => complete(b, 'notfound', { run: id, id }),
    ) as StorageProgram<Result>;
  },
  get_status(input) {
    const id = (input.run || input.id) as string;
    let p = createProgram();
    p = get(p, RELATION, id, 'rec');
    return branch(p, 'rec',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const run = bindings.rec as Record<string, unknown>;
        let cc = 0; try { cc = Object.keys(JSON.parse(run.results as string)).length; } catch {}
        const tc = run.total_count as number;
        return { run: id, id, status: run.status, completed_count: cc, total_count: tc, progress: tc > 0 ? cc / tc : 0, started_at: run.started_at, ended_at: run.ended_at };
      }),
      (b) => complete(b, 'notfound', { run: id, id }),
    ) as StorageProgram<Result>;
  },
  compare(input) {
    const run_id_a = (input.run_id_a || input.run_a) as string;
    const run_id_b = (input.run_id_b || input.run_b) as string;
    let p = createProgram();
    p = get(p, RELATION, run_id_a, 'runA');
    p = get(p, RELATION, run_id_b, 'runB');
    return branch(p, 'runA',
      (b) => branch(b, 'runB',
        (b2) => completeFrom(b2, 'ok', (bindings) => {
          const rA = bindings.runA as Record<string, unknown>; const rB = bindings.runB as Record<string, unknown>;
          let resA: Record<string, string> = {}; let resB: Record<string, string> = {};
          try { resA = JSON.parse(rA.results as string); } catch {} try { resB = JSON.parse(rB.results as string); } catch {}
          const allP = new Set([...Object.keys(resA), ...Object.keys(resB)]);
          const reg: string[] = []; const imp: string[] = []; const unch: string[] = [];
          for (const prop of allP) { const sa = resA[prop] || 'unknown'; const sb = resB[prop] || 'unknown'; if (sa === sb) unch.push(prop); else if (sa === 'proved' && sb !== 'proved') reg.push(prop); else if (sa !== 'proved' && sb === 'proved') imp.push(prop); else unch.push(prop); }
          return { run_id_a, run_id_b, regressions: JSON.stringify(reg), improvements: JSON.stringify(imp), unchanged: JSON.stringify(unch), regression_count: reg.length, improvement_count: imp.length, unchanged_count: unch.length };
        }),
        (b2) => complete(b2, 'notfound', { id: run_id_b }),
      ),
      (b) => complete(b, 'notfound', { id: run_id_a }),
    ) as StorageProgram<Result>;
  },
};
