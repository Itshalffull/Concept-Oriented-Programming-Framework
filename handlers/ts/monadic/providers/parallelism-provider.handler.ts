// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram, type Instruction,
} from '../../../../runtime/storage-program.ts';

/**
 * ParallelismProvider — functional handler.
 *
 * Analyzes a StorageProgram's instruction list to identify independent
 * instruction groups that can execute concurrently. Builds a dependency
 * graph from binding writes (bindAs) to binding reads (closure functions),
 * partitions into parallel layers via topological sort, and reports
 * max parallelism and theoretical speedup.
 */

type AnalysisResult = { variant: string; [key: string]: unknown };

/** Which bindings an instruction writes (via bindAs). */
function writtenBindings(instr: Instruction): string[] {
  switch (instr.tag) {
    case 'get':
    case 'find':
    case 'mapBindings':
      return [instr.bindAs];
    case 'bind':
      return [instr.bindAs];
    default:
      return [];
  }
}

/**
 * Whether an instruction reads from bindings (has a closure that
 * could reference accumulated bindings). Conservative: we assume
 * any closure reads ALL previously written bindings.
 */
function readsBindings(instr: Instruction): boolean {
  switch (instr.tag) {
    case 'branch':     // condition fn
    case 'pureFrom':   // fn
    case 'mapBindings': // fn
    case 'putFrom':    // valueFn
    case 'mergeFrom':  // fieldsFn
    case 'delFrom':    // keyFn
      return true;
    default:
      return false;
  }
}

/**
 * Check if an instruction writes to storage (side effect that must
 * be ordered with respect to reads/writes on the same relation).
 */
function writesRelation(instr: Instruction): string | null {
  switch (instr.tag) {
    case 'put':
    case 'merge':
    case 'putFrom':
    case 'mergeFrom':
      return instr.relation;
    case 'del':
    case 'delFrom':
      return instr.relation;
    default:
      return null;
  }
}

/**
 * Check if an instruction reads from storage.
 */
function readsRelation(instr: Instruction): string | null {
  switch (instr.tag) {
    case 'get':
    case 'find':
      return instr.relation;
    case 'merge':
    case 'mergeFrom':
      return instr.relation; // merge reads then writes
    default:
      return null;
  }
}

/** Whether an instruction is terminal (pure/pureFrom). */
function isTerminal(instr: Instruction): boolean {
  return instr.tag === 'pure' || instr.tag === 'pureFrom';
}

interface DependencyEdge {
  from: number;
  to: number;
  reason: string;
}

/**
 * Analyze a flat instruction list and produce parallel layers.
 */
function analyzeInstructions(instructions: Instruction[]): {
  layers: number[][];
  edges: DependencyEdge[];
  criticalPathLength: number;
  maxParallelism: number;
  speedupRatio: number;
} {
  const n = instructions.length;
  if (n === 0) {
    return { layers: [], edges: [], criticalPathLength: 0, maxParallelism: 0, speedupRatio: 1 };
  }

  const edges: DependencyEdge[] = [];

  // Track which instruction index wrote each binding
  const bindingWriter = new Map<string, number>();
  // Track all bindings written so far (for conservative closure reads)
  const allWrittenBindings = new Set<string>();
  // Track which instruction last wrote to each relation
  const relationWriter = new Map<string, number>();
  // Track which instruction last read from each relation
  const relationReader = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const instr = instructions[i];

    // Terminal instructions depend on everything before them
    if (isTerminal(instr)) {
      // A terminal depends on ALL prior instructions that haven't been
      // transitively covered. Simplification: depend on instruction i-1
      // if it exists, ensuring ordering.
      if (i > 0) {
        // Depend on all prior instructions (they must complete first)
        for (let j = 0; j < i; j++) {
          // Only add direct edges — the topological sort handles transitivity.
          // But terminal really does need all prior work done.
          edges.push({ from: j, to: i, reason: 'terminal depends on prior' });
        }
      }
      continue;
    }

    // If this instruction reads bindings (has a closure), it depends
    // on ALL instructions that wrote bindings before it (conservative).
    if (readsBindings(instr)) {
      for (const [binding, writerIdx] of bindingWriter) {
        edges.push({ from: writerIdx, to: i, reason: `reads binding '${binding}'` });
      }
    }

    // Storage relation ordering: write-after-read, read-after-write,
    // write-after-write on the same relation
    const wr = writesRelation(instr);
    const rr = readsRelation(instr);

    if (rr) {
      // Read-after-write: if someone wrote this relation, we depend on them
      const lastWriter = relationWriter.get(rr);
      if (lastWriter !== undefined && lastWriter !== i) {
        edges.push({ from: lastWriter, to: i, reason: `RAW on '${rr}'` });
      }
    }

    if (wr) {
      // Write-after-write: if someone else wrote this relation
      const lastWriter = relationWriter.get(wr);
      if (lastWriter !== undefined) {
        edges.push({ from: lastWriter, to: i, reason: `WAW on '${wr}'` });
      }
      // Write-after-read: if someone read this relation
      const lastReader = relationReader.get(wr);
      if (lastReader !== undefined && lastReader !== i) {
        edges.push({ from: lastReader, to: i, reason: `WAR on '${wr}'` });
      }
    }

    // Update tracking
    const written = writtenBindings(instr);
    for (const b of written) {
      bindingWriter.set(b, i);
      allWrittenBindings.add(b);
    }
    if (wr) relationWriter.set(wr, i);
    if (rr) relationReader.set(rr, i);
  }

  // Topological sort into layers (Kahn's algorithm variant)
  // Build adjacency list and in-degree
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  const inDeg = new Array(n).fill(0);

  for (const edge of edges) {
    if (!adj[edge.from].has(edge.to)) {
      adj[edge.from].add(edge.to);
      inDeg[edge.to]++;
    }
  }

  // Layer assignment
  const layers: number[][] = [];
  const assigned = new Set<number>();
  let remaining = new Set(Array.from({ length: n }, (_, i) => i));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0 among remaining
    const layer: number[] = [];
    for (const node of remaining) {
      if (inDeg[node] === 0) {
        layer.push(node);
      }
    }

    if (layer.length === 0) {
      // Cycle detected — shouldn't happen with valid programs.
      // Fall back: put all remaining in one layer.
      layers.push([...remaining]);
      break;
    }

    layer.sort((a, b) => a - b); // Stable ordering
    layers.push(layer);

    for (const node of layer) {
      assigned.add(node);
      remaining.delete(node);
      for (const neighbor of adj[node]) {
        inDeg[neighbor]--;
      }
    }
  }

  const criticalPathLength = layers.length;
  const maxParallelism = Math.max(...layers.map(l => l.length), 0);
  const speedupRatio = n > 0 && criticalPathLength > 0
    ? parseFloat((n / criticalPathLength).toFixed(2))
    : 1;

  return { layers, edges, criticalPathLength, maxParallelism, speedupRatio };
}

export const parallelismProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const programStr = input.program as string;

    try {
      let parsed: { instructions: Instruction[] };
      try {
        parsed = JSON.parse(programStr);
      } catch {
        const p = pure(createProgram(), {
          variant: 'error',
          message: 'Could not parse program string as JSON',
        });
        return p as StorageProgram<AnalysisResult>;
      }

      const instructions = parsed.instructions || [];
      const { layers, edges, criticalPathLength, maxParallelism, speedupRatio } =
        analyzeInstructions(instructions);

      if (maxParallelism <= 1) {
        const resultId = `par-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let p = createProgram();
        p = put(p, 'results', resultId, {
          layers: JSON.stringify(layers),
          dependencyEdges: JSON.stringify(edges),
          criticalPathLength,
          maxParallelism,
          speedupRatio,
        });
        p = pure(p, {
          variant: 'sequential',
          result: resultId,
          reason: 'All instructions form a linear dependency chain',
        });
        return p as StorageProgram<AnalysisResult>;
      }

      const resultId = `par-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = put(p, 'results', resultId, {
        layers: JSON.stringify(layers),
        dependencyEdges: JSON.stringify(edges),
        criticalPathLength,
        maxParallelism,
        speedupRatio,
      });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        layers: JSON.stringify(layers),
        dependencyEdges: JSON.stringify(edges),
        criticalPathLength,
        maxParallelism,
        speedupRatio,
      });
      return p as StorageProgram<AnalysisResult>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Parallelism analysis failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<AnalysisResult>;
    }
  },
};

// Export the analysis function for use by the interpreter
export { analyzeInstructions };
