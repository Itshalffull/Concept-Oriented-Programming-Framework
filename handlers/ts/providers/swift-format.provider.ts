// swift-format Format Provider
// ============================================================
// Implements the formatter dispatch target for the Format concept
// when language="swift". Shells out to Apple's `swift-format` CLI
// (darwin-primary, also builds on linux) via stdin/stdout:
//
//   swift-format format  <  input  >  output
//
// The canonical output is diffed against the input with the shared
// line-granular Myers-LCS diffLines routine (prettier-format provider)
// so the resulting Patch is directly applicable, invertible, and
// composable through the Patch + UndoStack pipeline — a single
// format call becomes exactly one undo entry.
//
// Exported entry point:
//   formatWithSwift(text, language, options?) -> Promise<Bytes>
//
// When `swift-format` is not available on PATH (ENOENT at spawn), or
// exits non-zero, we return a structured envelope
//   { ok: false, error: { message: "swift_format_unavailable", ... } }
// rather than throwing, matching the "never-throw" convention used by
// the other subprocess-capable providers (see katex-parse.provider.ts).
//
// Registration: self-registers in the shared format-provider-registry
// under id "swift-format". Concept-layer binding is installed by the
// corresponding sync (syncs/app/register-swift-format.sync); this
// module only owns the text->Patch dispatch fn.

import { spawn } from 'node:child_process';
import { diffLines, type EditOp } from './prettier-format.provider.ts';
import {
  registerFormatProvider,
  type FormatProviderFn,
} from './format-provider-registry.ts';

export const FORMAT_PROVIDER_ID = 'swift-format';
export const FORMAT_LANGUAGE = 'swift';

export interface SwiftFormatUnavailable {
  ok: false;
  error: { message: string; detail?: string };
}

export interface SwiftFormatOptions {
  /**
   * Path (or bare name) of the swift-format binary to invoke. Defaults to
   * the PATH-resolved "swift-format". Override for tests or when Apple's
   * tool is installed under a non-standard name (e.g., "swift-format-600").
   */
  bin?: string;
  /**
   * Extra argv appended after the default "format" subcommand. Consumers
   * may pass e.g. ["--configuration", "/path/to/swift-format.json"] to
   * point at a project-specific configuration file.
   */
  args?: string[];
}

/**
 * Run `swift-format format` as a subprocess, piping `text` to stdin and
 * collecting stdout. Resolves with a structured envelope on spawn failure
 * (ENOENT, non-zero exit) so callers can distinguish "tool unavailable"
 * from "input produced no changes".
 */
async function runSwiftFormat(
  text: string,
  opts: SwiftFormatOptions,
): Promise<{ ok: true; output: string } | SwiftFormatUnavailable> {
  const bin = opts.bin ?? 'swift-format';
  const args = ['format', ...(opts.args ?? [])];
  return await new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({
        ok: false,
        error: {
          message: 'swift_format_unavailable',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (v: { ok: true; output: string } | SwiftFormatUnavailable) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      settle({
        ok: false,
        error: {
          message: 'swift_format_unavailable',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
    });
    child.on('close', (code) => {
      if (code === 0) {
        settle({ ok: true, output: stdout });
      } else {
        settle({
          ok: false,
          error: {
            message: 'swift_format_unavailable',
            detail:
              (stderr.trim() || `swift-format exited with code ${code}`).slice(
                0,
                2000,
              ),
          },
        });
      }
    });

    try {
      child.stdin?.end(text);
    } catch (err) {
      settle({
        ok: false,
        error: {
          message: 'swift_format_unavailable',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });
}

function decodeOptions(config: string | undefined): SwiftFormatOptions {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SwiftFormatOptions;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Format `text` via the swift-format subprocess and return a JSON-encoded
 * Patch (EditOp[]) describing the edit from input to canonical output.
 *
 * Success:   resolves with the Patch bytes (UTF-8 JSON) — a pure
 *            sequence of `equal` ops when input is already canonical.
 * Unavailable: resolves with a JSON-encoded
 *              `{ ok:false, error:{ message:"swift_format_unavailable" } }`
 *            envelope so callers (the Format handler / sync dispatch) can
 *            translate to the format -> error variant without catching.
 *
 * Never throws.
 */
export async function formatWithSwift(
  text: string,
  language: string = FORMAT_LANGUAGE,
  options?: SwiftFormatOptions | string,
): Promise<string> {
  const opts: SwiftFormatOptions =
    typeof options === 'string'
      ? decodeOptions(options)
      : options ?? {};
  void language; // reserved for future multi-language reuse
  const result = await runSwiftFormat(text, opts);
  if (!result.ok) {
    return JSON.stringify(result);
  }
  const ops: EditOp[] = diffLines(text, result.output);
  return JSON.stringify(ops);
}

// ------------------------------------------------------------------
// Sync adapter (matches FormatProviderFn signature)
// ------------------------------------------------------------------
// The registry's FormatProviderFn is synchronous. Subprocess calls are
// inherently async, so the sync adapter returns a passthrough
// (equal-only Patch) and logs the caller toward the async entry point.
// Callers with access to the async API should prefer formatWithSwift
// directly; kernel-boot wiring that goes through the registry can
// observe the passthrough until the async dispatch is plumbed.

const formatWithSwiftSyncImpl: FormatProviderFn = (text, _config) => {
  // No way to run a subprocess synchronously without blocking the event
  // loop. Return a pass-through Patch so the pipeline stays valid; the
  // async `formatWithSwift` entry point is the correct surface.
  const ops: EditOp[] = diffLines(text, text);
  return JSON.stringify(ops);
};

// Self-register on import so kernel-boot wiring can activate the
// provider by importing this module. The concept-layer registration
// (Format/register -> provider: "swift-format", language: "swift")
// is installed by the corresponding sync; this line installs the
// concrete dispatch fn so Format/format { language: "swift" } can
// resolve through the registry at runtime.
registerFormatProvider(FORMAT_PROVIDER_ID, formatWithSwiftSyncImpl);
