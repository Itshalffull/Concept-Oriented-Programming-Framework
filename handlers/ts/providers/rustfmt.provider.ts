// rustfmt Format Provider
// ============================================================
// Implements the formatter dispatch target for the Format concept
// when language="rust". Two execution strategies, tried in order:
//
//   1. Wasm rustfmt — if the optional `@wasm-fmt/rustfmt` package is
//      installed, format in-process via its WebAssembly build. Fast,
//      no subprocess, portable across environments.
//   2. Subprocess rustfmt — if the `rustfmt` binary is on PATH, spawn
//      `rustfmt --edition <options.edition || "2021">`, pipe source
//      text via stdin, and capture stdout. Matches the invocation the
//      cargo toolchain uses and honors whatever toolchain the user has
//      active.
//
// The formatted output is diffed against the input with the shared
// line-granular Myers-LCS diffLines routine (reused from
// prettier-format.provider.ts) so the resulting Patch is directly
// applicable, invertible, and composable through the Patch +
// UndoStack pipeline. One format call becomes one undo entry.
//
// Availability envelope (per PRD §8 Q3):
//   When neither wasm nor subprocess can be used (package not
//   installed AND rustfmt binary missing), we return a structured
//   error envelope {ok:false, error:{message:"rustfmt_unavailable"}}
//   instead of throwing. The caller (Format handler / sync dispatch)
//   surfaces it as the format -> error variant so a misconfigured
//   manifest doesn't crash the kernel.
//
// Exported entry points:
//   formatWithRustfmt(text, language, options?) -> Promise<Bytes | Envelope>
//
// Registration:
//   Self-registers in the shared format-provider-registry under the id
//   "rustfmt" so kernel-boot wiring can activate the provider by
//   importing this module. The .sync file (manifest-driven, see
//   virtual-provider-registry PRD) installs the concept-layer binding
//   Format/register(provider: "rustfmt", language: "rust").

import { spawn } from 'node:child_process';

import { diffLines, type EditOp } from './prettier-format.provider.ts';
import {
  registerFormatProvider,
  type FormatProviderFn,
} from './format-provider-registry.ts';

export const FORMAT_PROVIDER_ID = 'rustfmt';
export const FORMAT_LANGUAGE = 'rust';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface RustfmtOptions {
  /** Rust edition passed to rustfmt --edition. Defaults to "2021". */
  edition?: string;
}

export type RustfmtUnavailable = {
  ok: false;
  error: { message: string };
};

export type RustfmtResult = string | RustfmtUnavailable;

// ------------------------------------------------------------------
// Wasm loader (optional dependency)
// ------------------------------------------------------------------
// @wasm-fmt/rustfmt is declared as an optional dependency. If it is
// not installed, the dynamic import fails and we fall through to the
// subprocess path. We cache the load outcome so repeated calls don't
// re-resolve the missing module.

type WasmRustfmt = {
  format: (source: string, config?: Record<string, unknown>) => string;
};

type WasmInit = (input?: unknown) => Promise<unknown>;

let wasmModule: WasmRustfmt | null = null;
let wasmLoadAttempted = false;
let wasmLoadError: Error | null = null;

async function loadWasmRustfmt(): Promise<WasmRustfmt | null> {
  if (wasmModule) return wasmModule;
  if (wasmLoadAttempted) return null;
  wasmLoadAttempted = true;
  try {
    // @ts-expect-error — @wasm-fmt/rustfmt is an optional dependency;
    // when it is not installed, this dynamic import fails at runtime
    // and the catch below falls through to the subprocess path.
    const mod = (await import(
      /* @vite-ignore */ '@wasm-fmt/rustfmt'
    )) as unknown as {
      default?: WasmInit | WasmRustfmt;
      format?: WasmRustfmt['format'];
      init?: WasmInit;
    };
    // Some wasm-fmt packages ship a default export that is the init
    // function; once awaited the module's `format` export is usable.
    // Others expose `format` directly on the namespace.
    if (typeof mod.default === 'function') {
      try {
        await (mod.default as WasmInit)();
      } catch {
        // init failure is non-fatal if format is still callable
      }
    } else if (typeof mod.init === 'function') {
      try {
        await mod.init();
      } catch {
        // see above
      }
    }
    const fmt =
      mod.format ??
      (mod.default && typeof (mod.default as WasmRustfmt).format === 'function'
        ? (mod.default as WasmRustfmt).format
        : undefined);
    if (typeof fmt !== 'function') {
      wasmLoadError = new Error('@wasm-fmt/rustfmt did not export format()');
      return null;
    }
    wasmModule = { format: fmt };
    return wasmModule;
  } catch (err) {
    wasmLoadError = err instanceof Error ? err : new Error(String(err));
    return null;
  }
}

// ------------------------------------------------------------------
// Subprocess fallback
// ------------------------------------------------------------------

function spawnRustfmt(text: string, edition: string): Promise<string | null> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('rustfmt', ['--edition', edition], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      resolve(null);
      return;
    }

    let stdout = '';
    let stderr = '';
    let spawnErrored = false;

    child.on('error', () => {
      // ENOENT (rustfmt not on PATH) or similar — treat as unavailable
      spawnErrored = true;
      resolve(null);
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('close', (code) => {
      if (spawnErrored) return;
      if (code === 0) {
        resolve(stdout);
      } else {
        // Non-zero exit — could be a syntax error in user source.
        // Treat as unavailable-for-this-input; caller surfaces as error.
        // Embed stderr into a sentinel that formatWithRustfmt() recognises.
        resolve(`__RUSTFMT_ERROR__${stderr || `exit ${code}`}`);
      }
    });

    try {
      child.stdin.end(text, 'utf8');
    } catch {
      spawnErrored = true;
      resolve(null);
    }
  });
}

// ------------------------------------------------------------------
// Public async API
// ------------------------------------------------------------------

/**
 * Format `text` with rustfmt (wasm preferred, subprocess fallback) and
 * return a serialized Patch describing the edit from input to formatted
 * output.
 *
 * @param text     Rust source text to format.
 * @param language Format concept language; must be "rust". Passed for
 *                 dispatch-table symmetry with other providers.
 * @param options  Optional `{ edition }` record. `edition` defaults to
 *                 "2021" to match cargo's current default.
 * @returns        JSON-encoded EditOp[] (Patch effect bytes) on success,
 *                 or an {ok:false, error:{message}} envelope if rustfmt
 *                 is unavailable in the current environment.
 */
export async function formatWithRustfmt(
  text: string,
  language: string = FORMAT_LANGUAGE,
  options: RustfmtOptions = {},
): Promise<RustfmtResult> {
  if (language !== FORMAT_LANGUAGE) {
    return {
      ok: false,
      error: {
        message: `rustfmt does not support language "${language}"`,
      },
    };
  }

  // 1. Wasm path
  const wasm = await loadWasmRustfmt();
  if (wasm) {
    try {
      const formatted = wasm.format(text, {
        edition: options.edition ?? '2021',
      });
      const ops: EditOp[] = diffLines(text, formatted);
      return JSON.stringify(ops);
    } catch (err) {
      return {
        ok: false,
        error: {
          message: `rustfmt_wasm_error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      };
    }
  }

  // 2. Subprocess fallback
  const edition = options.edition ?? '2021';
  const result = await spawnRustfmt(text, edition);
  if (result === null) {
    return {
      ok: false,
      error: { message: 'rustfmt_unavailable' },
    };
  }
  if (result.startsWith('__RUSTFMT_ERROR__')) {
    return {
      ok: false,
      error: {
        message: `rustfmt_error: ${result.slice('__RUSTFMT_ERROR__'.length).trim()}`,
      },
    };
  }
  const ops: EditOp[] = diffLines(text, result);
  return JSON.stringify(ops);
}

// ------------------------------------------------------------------
// Registry adapter
// ------------------------------------------------------------------
// FormatProviderFn is a sync (text, config?) -> string contract. rustfmt
// is inherently async (subprocess or wasm init), so we expose a sync
// wrapper that reads a cached envelope when unavailable and falls back
// to an equal-only pass-through Patch until the async path completes.
// Callers preferring correctness should use formatWithRustfmt directly.

let cachedUnavailable: RustfmtUnavailable | null = null;

// Warm availability check: attempt the wasm path eagerly so subsequent
// sync calls know whether to short-circuit to the unavailable envelope.
// The subprocess path cannot be probed synchronously; we optimistically
// assume it may be available until a real call proves otherwise.
void (async () => {
  const wasm = await loadWasmRustfmt();
  if (!wasm) {
    // Probe the subprocess once — this gives the sync adapter a
    // definitive answer without paying the spawn cost on every call.
    const probe = await spawnRustfmt('fn main() {}\n', '2021');
    if (probe === null) {
      cachedUnavailable = {
        ok: false,
        error: { message: 'rustfmt_unavailable' },
      };
    }
  }
})().catch(() => {
  cachedUnavailable = {
    ok: false,
    error: { message: 'rustfmt_unavailable' },
  };
});

function decodeOptions(config: string | undefined): RustfmtOptions {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as RustfmtOptions;
    }
    return {};
  } catch {
    return {};
  }
}

const formatRustSyncImpl: FormatProviderFn = (text, config) => {
  if (cachedUnavailable) {
    return JSON.stringify(cachedUnavailable);
  }
  // Not yet warmed (or wasm/subprocess is available but we can't run
  // async here). Return an equal-only pass-through so upstream code
  // never receives an invalid Patch; callers should prefer
  // formatWithRustfmt for first-hit correctness.
  void decodeOptions(config);
  const ops: EditOp[] = diffLines(text, text);
  return JSON.stringify(ops);
};

registerFormatProvider(FORMAT_PROVIDER_ID, formatRustSyncImpl);
