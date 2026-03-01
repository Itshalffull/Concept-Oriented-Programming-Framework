// DatalogAnalysisProvider — Evaluates Datalog-style fact/rule programs:
// asserts ground facts, defines Horn clause rules, evaluates queries
// via bottom-up fixpoint computation (naive evaluation).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DatalogAnalysisProviderStorage,
  DatalogAnalysisProviderInitializeInput,
  DatalogAnalysisProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface DatalogAnalysisProviderError {
  readonly code: string;
  readonly message: string;
}

// A ground fact: relation(arg1, arg2, ...)
interface Fact {
  readonly relation: string;
  readonly args: readonly string[];
}

// A rule: head :- body1, body2, ...
// Each atom has a relation and a list of terms (variables start with uppercase or _)
interface Atom {
  readonly relation: string;
  readonly terms: readonly string[];
}

interface Rule {
  readonly head: Atom;
  readonly body: readonly Atom[];
}

// Binding maps variables to values during evaluation
type Binding = ReadonlyMap<string, string>;

// --- Helpers ---

const storageError = (error: unknown): DatalogAnalysisProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `dap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

const isVariable = (term: string): boolean =>
  term.length > 0 && (term[0] === '_' || (term[0] >= 'A' && term[0] <= 'Z'));

// Encode a fact as a unique key
const factKey = (fact: Fact): string =>
  `${fact.relation}(${fact.args.join(',')})`;

// Try to unify an atom against a fact, extending the current binding
const unifyAtom = (atom: Atom, fact: Fact, binding: Binding): O.Option<Binding> => {
  if (atom.relation !== fact.relation) return O.none;
  if (atom.terms.length !== fact.args.length) return O.none;

  const newBinding = new Map(binding);
  for (let i = 0; i < atom.terms.length; i++) {
    const term = atom.terms[i];
    const arg = fact.args[i];

    if (isVariable(term)) {
      const existing = newBinding.get(term);
      if (existing !== undefined) {
        if (existing !== arg) return O.none;
      } else {
        newBinding.set(term, arg);
      }
    } else {
      // Constant — must match exactly
      if (term !== arg) return O.none;
    }
  }

  return O.some(newBinding);
};

// Instantiate head atom with a complete binding to produce a fact
const instantiateHead = (head: Atom, binding: Binding): O.Option<Fact> => {
  const args: string[] = [];
  for (const term of head.terms) {
    if (isVariable(term)) {
      const val = binding.get(term);
      if (val === undefined) return O.none;
      args.push(val);
    } else {
      args.push(term);
    }
  }
  return O.some({ relation: head.relation, args });
};

// Evaluate all body atoms against the current fact set, collecting bindings
const evaluateBody = (
  bodyAtoms: readonly Atom[],
  facts: ReadonlyMap<string, Fact>,
  initialBinding: Binding,
): readonly Binding[] => {
  if (bodyAtoms.length === 0) return [initialBinding];

  const [first, ...rest] = bodyAtoms;
  const bindings: Binding[] = [];
  const factArray = [...facts.values()];

  for (const fact of factArray) {
    const unified = unifyAtom(first, fact, initialBinding);
    pipe(
      unified,
      O.fold(
        () => {},
        (newBinding) => {
          const childBindings = evaluateBody(rest, facts, newBinding);
          bindings.push(...childBindings);
        },
      ),
    );
  }

  return bindings;
};

// Naive fixpoint evaluation: repeatedly apply rules until no new facts are derived
const fixpointEval = (
  initialFacts: readonly Fact[],
  rules: readonly Rule[],
  maxIterations: number = 100,
): readonly Fact[] => {
  const factMap = new Map<string, Fact>();
  for (const f of initialFacts) {
    factMap.set(factKey(f), f);
  }

  let changed = true;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const rule of rules) {
      const bindings = evaluateBody(rule.body, factMap, new Map());

      for (const binding of bindings) {
        const newFactOpt = instantiateHead(rule.head, binding);
        pipe(
          newFactOpt,
          O.fold(
            () => {},
            (newFact) => {
              const key = factKey(newFact);
              if (!factMap.has(key)) {
                factMap.set(key, newFact);
                changed = true;
              }
            },
          ),
        );
      }
    }
  }

  return [...factMap.values()];
};

// Parse a simple fact string: "relation(arg1, arg2)"
const parseFact = (str: string): O.Option<Fact> => {
  const match = str.trim().match(/^(\w+)\(([^)]*)\)$/);
  if (match === null) return O.none;
  const relation = match[1];
  const args = match[2].split(',').map((a) => a.trim()).filter((a) => a.length > 0);
  return O.some({ relation, args });
};

// Parse a rule string: "head(X, Y) :- body1(X), body2(Y)"
const parseRule = (str: string): O.Option<Rule> => {
  const parts = str.split(':-').map((p) => p.trim());
  if (parts.length !== 2) return O.none;

  const headMatch = parts[0].match(/^(\w+)\(([^)]*)\)$/);
  if (headMatch === null) return O.none;
  const head: Atom = {
    relation: headMatch[1],
    terms: headMatch[2].split(',').map((t) => t.trim()).filter((t) => t.length > 0),
  };

  const bodyParts = parts[1].split(/\),\s*/).map((p) => p.trim().replace(/\)$/, ''));
  const body: Atom[] = [];
  for (const bp of bodyParts) {
    const bm = bp.match(/^(\w+)\(([^)]*)$/);
    if (bm === null) continue;
    body.push({
      relation: bm[1],
      terms: bm[2].split(',').map((t) => t.trim()).filter((t) => t.length > 0),
    });
  }

  if (body.length === 0) return O.none;
  return O.some({ head, body });
};

// --- Handler interface ---

export interface DatalogAnalysisProviderHandler {
  readonly initialize: (
    input: DatalogAnalysisProviderInitializeInput,
    storage: DatalogAnalysisProviderStorage,
  ) => TE.TaskEither<DatalogAnalysisProviderError, DatalogAnalysisProviderInitializeOutput>;
  readonly assertFact: (
    input: { readonly factStr: string },
    storage: DatalogAnalysisProviderStorage,
  ) => TE.TaskEither<DatalogAnalysisProviderError, { readonly added: boolean }>;
  readonly addRule: (
    input: { readonly ruleStr: string },
    storage: DatalogAnalysisProviderStorage,
  ) => TE.TaskEither<DatalogAnalysisProviderError, { readonly ruleId: string }>;
  readonly query: (
    input: { readonly relation: string; readonly pattern: readonly string[] },
    storage: DatalogAnalysisProviderStorage,
  ) => TE.TaskEither<DatalogAnalysisProviderError, { readonly results: readonly Fact[] }>;
  readonly computeFixpoint: (
    storage: DatalogAnalysisProviderStorage,
  ) => TE.TaskEither<DatalogAnalysisProviderError, { readonly totalFacts: number; readonly derivedFacts: number }>;
}

// --- Implementation ---

export const datalogAnalysisProviderHandler: DatalogAnalysisProviderHandler = {
  // Load existing fact and rule sets, verify storage.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const facts = await storage.find('datalog_facts');
          const rules = await storage.find('datalog_rules');
          await storage.put('datalog_instances', instanceId, {
            id: instanceId,
            factCount: facts.length,
            ruleCount: rules.length,
            createdAt: nowISO(),
          });
          return instanceId;
        },
        storageError,
      ),
      TE.map((instanceId) => initializeOk(instanceId)),
      TE.orElse((err) =>
        TE.right(initializeLoadError(err.message)),
      ),
    ),

  // Parse and store a ground fact.
  assertFact: (input, storage) =>
    pipe(
      O.fromNullable(input.factStr),
      O.chain(parseFact),
      O.fold(
        () => TE.left<DatalogAnalysisProviderError, { readonly added: boolean }>({
          code: 'PARSE_ERROR',
          message: `Cannot parse fact: ${input.factStr}`,
        }),
        (fact) =>
          TE.tryCatch(
            async () => {
              const key = factKey(fact);
              const existing = await storage.get('datalog_facts', key);
              if (existing !== null) return { added: false };
              await storage.put('datalog_facts', key, {
                relation: fact.relation,
                args: JSON.stringify(fact.args),
                key,
                createdAt: nowISO(),
              });
              return { added: true };
            },
            storageError,
          ),
      ),
    ),

  // Parse and store a Horn clause rule.
  addRule: (input, storage) =>
    pipe(
      O.fromNullable(input.ruleStr),
      O.chain(parseRule),
      O.fold(
        () => TE.left<DatalogAnalysisProviderError, { readonly ruleId: string }>({
          code: 'PARSE_ERROR',
          message: `Cannot parse rule: ${input.ruleStr}`,
        }),
        (rule) =>
          TE.tryCatch(
            async () => {
              const ruleId = generateId();
              await storage.put('datalog_rules', ruleId, {
                id: ruleId,
                head: JSON.stringify(rule.head),
                body: JSON.stringify(rule.body),
                raw: input.ruleStr,
                createdAt: nowISO(),
              });
              return { ruleId };
            },
            storageError,
          ),
      ),
    ),

  // Query matching facts for a given relation with optional variable/constant pattern.
  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('datalog_facts', { relation: input.relation }),
        storageError,
      ),
      TE.map((records) => {
        const queryAtom: Atom = { relation: input.relation, terms: [...input.pattern] };
        const results: Fact[] = [];
        for (const r of records) {
          const fact: Fact = {
            relation: String(r['relation'] ?? ''),
            args: JSON.parse(String(r['args'] ?? '[]')),
          };
          const unified = unifyAtom(queryAtom, fact, new Map());
          pipe(
            unified,
            O.fold(
              () => {},
              () => { results.push(fact); },
            ),
          );
        }
        return { results };
      }),
    ),

  // Run the naive fixpoint algorithm over all stored facts and rules.
  computeFixpoint: (storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const factRecords = await storage.find('datalog_facts');
          const ruleRecords = await storage.find('datalog_rules');
          return { factRecords, ruleRecords };
        },
        storageError,
      ),
      TE.chain(({ factRecords, ruleRecords }) => {
        const facts: Fact[] = factRecords.map((r) => ({
          relation: String(r['relation'] ?? ''),
          args: JSON.parse(String(r['args'] ?? '[]')),
        }));
        const rules: Rule[] = ruleRecords.map((r) => ({
          head: JSON.parse(String(r['head'] ?? '{}')),
          body: JSON.parse(String(r['body'] ?? '[]')),
        }));

        const initialCount = facts.length;
        const allFacts = fixpointEval(facts, rules);
        const derivedCount = allFacts.length - initialCount;

        return TE.tryCatch(
          async () => {
            // Persist derived facts
            for (const fact of allFacts) {
              const key = factKey(fact);
              await storage.put('datalog_facts', key, {
                relation: fact.relation,
                args: JSON.stringify(fact.args),
                key,
                derived: true,
                createdAt: nowISO(),
              });
            }
            return { totalFacts: allFacts.length, derivedFacts: derivedCount };
          },
          storageError,
        );
      }),
    ),
};
