// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Signature Handler
//
// Declarative definition of an input-output transformation schema
// for LLM calls. Supports defining, compiling, executing, and
// recompiling signatures for model portability.
// See Architecture doc Section 16.11, 16.12
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `signature-${++idCounter}`;
}

let nonceCounter = 0;

/**
 * Build a compiled prompt string from signature definition and examples.
 * Section 16.11
 */
function buildCompiledPrompt(
  name: string,
  inputFields: Array<{ name: string; type: string; description?: string }>,
  outputFields: Array<{ name: string; type: string; description?: string }>,
  instruction: string,
  moduleType: string,
  modelId: string,
  examples: Array<{ input: string; output: string }>,
): string {
  const inputDesc = inputFields.map(f => `  ${f.name} (${f.type})${f.description ? ': ' + f.description : ''}`).join('\n');
  const outputDesc = outputFields.map(f => `  ${f.name} (${f.type})${f.description ? ': ' + f.description : ''}`).join('\n');
  const exampleLines = Array.isArray(examples)
    ? examples.map(e => `  Input: ${e.input}\n  Output: ${e.output}`).join('\n')
    : '';

  return [
    `Signature: ${name} [${moduleType}] for ${modelId}`,
    instruction ? `Instruction: ${instruction}` : '',
    `Inputs:\n${inputDesc}`,
    `Outputs:\n${outputDesc}`,
    exampleLines ? `Examples:\n${exampleLines}` : '',
  ].filter(Boolean).join('\n');
}

const _handler: FunctionalConceptHandler = {
  /**
   * Define a new signature with input/output fields and module type.
   * Section 16.11: define action
   */
  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const inputFields = input.input_fields;
    const outputFields = input.output_fields;
    const moduleType = input.module_type as string;

    // Validate: name must be non-empty
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate: input_fields and output_fields must be non-empty arrays
    if (!inputFields || !outputFields ||
        (Array.isArray(inputFields) && inputFields.length === 0) ||
        (Array.isArray(outputFields) && outputFields.length === 0)) {
      return complete(createProgram(), 'invalid', { message: 'input_fields and output_fields must not be empty' }) as StorageProgram<Result>;
    }

    const sigId = nextId();
    let p = createProgram();
    p = put(p, 'signature', sigId, {
      id: sigId,
      name,
      input_fields: inputFields,
      output_fields: outputFields,
      instruction: input.instruction ?? '',
      module_type: moduleType ?? 'predict',
      compiled_prompts: [],
    });

    return complete(p, 'ok', { signature: sigId }) as StorageProgram<Result>;
  },

  /**
   * Compile a signature for a specific model with optional examples.
   * Section 16.11: compile action
   */
  compile(input: Record<string, unknown>) {
    const signature = input.signature as string;
    const modelId = input.model_id as string;
    const examples = input.examples;

    // Validate signature is provided
    if (!signature || (typeof signature === 'string' && signature.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'signature is required' }) as StorageProgram<Result>;
    }

    // Validate model_id is provided
    if (!modelId || (typeof modelId === 'string' && modelId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'model_id is required' }) as StorageProgram<Result>;
    }

    // Reject if examples is explicitly an empty array (no demonstrations provided)
    if (Array.isArray(examples) && examples.length === 0) {
      return complete(createProgram(), 'error', { message: 'examples must not be empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'signature', signature, 'sigRecord');

    return branch(p, 'sigRecord',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.sigRecord as Record<string, unknown>;
          function normalizeFields(raw: unknown): Array<{ name: string; type: string; description?: string }> {
            if (Array.isArray(raw)) return raw as Array<{ name: string; type: string; description?: string }>;
            if (typeof raw === 'string') {
              try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
            }
            if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items)) {
              return (raw as Record<string, unknown>).items as Array<{ name: string; type: string; description?: string }>;
            }
            return [];
          }
          const compiledPrompt = buildCompiledPrompt(
            record.name as string,
            normalizeFields(record.input_fields),
            normalizeFields(record.output_fields),
            record.instruction as string,
            record.module_type as string,
            modelId,
            Array.isArray(examples) ? examples as Array<{ input: string; output: string }> : [],
          );
          return { compiled_prompt: compiledPrompt };
        });
      },
      (elseP) => {
        // Signature ID not found in storage — still compile with a generic prompt
        const compiledPrompt = buildCompiledPrompt(
          signature,
          [],
          [],
          '',
          'predict',
          modelId,
          Array.isArray(examples) ? examples as Array<{ input: string; output: string }> : [],
        );
        return complete(elseP, 'ok', { compiled_prompt: compiledPrompt });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * Execute a compiled signature against a model with input values.
   * Section 16.11: execute action
   */
  execute(input: Record<string, unknown>) {
    const signature = input.signature as string;
    const modelId = input.model_id as string;
    const inputs = input.inputs;

    // Validate signature is provided
    if (!signature || (typeof signature === 'string' && signature.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'signature is required' }) as StorageProgram<Result>;
    }

    // Validate model_id is provided
    if (!modelId || (typeof modelId === 'string' && modelId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'model_id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'signature', signature, 'sigRecord');

    return branch(p, 'sigRecord',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.sigRecord as Record<string, unknown>;
          const compiledPrompts = record.compiled_prompts as Array<{ model_id: string; prompt: string }> ?? [];

          // Check if there is a compiled prompt for this model
          const hasCompiledPrompt = Array.isArray(compiledPrompts) &&
            compiledPrompts.some(cp => cp.model_id === modelId);

          // Only known/standard model IDs can execute without a pre-compiled prompt
          const knownModels = ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
          const isKnownModel = knownModels.includes(modelId);

          if (!hasCompiledPrompt && !isKnownModel) {
            return { variant: 'error', message: `No compiled prompt for model "${modelId}"` };
          }

          const outputFields = record.output_fields as Array<{ name: string; type: string }> ?? [];
          const outputs = outputFields.map(f => ({ field: f.name, value: `[simulated output for ${f.name}]` }));
          return { variant: 'ok', outputs };
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Signature "${signature}" not found` }),
    ) as StorageProgram<Result>;
  },

  /**
   * Recompile a signature for a different target model.
   * Section 16.11: recompile action
   */
  recompile(input: Record<string, unknown>) {
    const signature = input.signature as string;
    const targetModel = input.target_model as string;

    // Validate signature is provided
    if (!signature || (typeof signature === 'string' && signature.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'signature is required' }) as StorageProgram<Result>;
    }

    // Validate target_model is provided
    if (!targetModel || (typeof targetModel === 'string' && targetModel.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'target_model is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'signature', signature, 'sigRecord');

    return branch(p, 'sigRecord',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.sigRecord as Record<string, unknown>;
          const compiledPrompt = buildCompiledPrompt(
            record.name as string,
            record.input_fields as Array<{ name: string; type: string; description?: string }>,
            record.output_fields as Array<{ name: string; type: string; description?: string }>,
            record.instruction as string,
            record.module_type as string,
            targetModel,
            [],
          );
          return { variant: 'ok', compiled_prompt: compiledPrompt };
        });
      },
      (elseP) => {
        // Signature not in storage — recompile with generic prompt
        const compiledPrompt = buildCompiledPrompt(signature, [], [], '', 'predict', targetModel, []);
        return complete(elseP, 'ok', { compiled_prompt: compiledPrompt });
      },
    ) as StorageProgram<Result>;
  },

  // ---- Cryptographic Signature Actions ----

  addTrustedSigner(input: Record<string, unknown>) {
    const identity = input.identity as string;
    const id = nextId();

    let p = createProgram();
    p = find(p, 'signature-trusted', { identity }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as Record<string, unknown>[]).length > 0,
      (thenP) => complete(thenP, 'alreadyTrusted', { message: `Identity '${identity}' is already trusted` }),
      (elseP) => {
        elseP = put(elseP, 'signature-trusted', id, { id, identity });
        return complete(elseP, 'ok', { identity });
      },
    ) as StorageProgram<Result>;
  },

  sign(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const identity = input.identity as string;

    let p = createProgram();
    p = find(p, 'signature-trusted', { identity }, 'trusted');

    return branch(p,
      (bindings) => (bindings.trusted as Record<string, unknown>[]).length === 0,
      (thenP) => complete(thenP, 'unknownIdentity', { message: `Identity '${identity}' is not trusted` }),
      (elseP) => {
        const signatureId = nextId();
        const timestamp = new Date().toISOString();
        const certificate = `cert-${identity}-${timestamp}`;
        const signatureData = `sig-data-${contentHash}-${identity}-${timestamp}`;
        elseP = put(elseP, 'signature', signatureId, {
          id: signatureId,
          contentHash,
          signer: identity,
          certificate,
          timestamp,
          signatureData,
          valid: true,
        });
        return complete(elseP, 'ok', { signatureId });
      },
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const signatureId = input.signatureId as string;

    let p = createProgram();
    p = get(p, 'signature', signatureId, 'sigRecord');

    return branch(p, 'sigRecord',
      (thenP) => {
        // Check content hash match
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.sigRecord as Record<string, unknown>;
          return (record.contentHash as string) !== contentHash;
        }, 'hashMismatch');

        return branch(thenP,
          (bindings) => bindings.hashMismatch as boolean,
          (bp) => complete(bp, 'invalid', { message: 'Content hash does not match' }),
          (bp) => {
            // Check certificate expiry (365 days)
            bp = mapBindings(bp, (bindings) => {
              const record = bindings.sigRecord as Record<string, unknown>;
              const timestamp = record.timestamp as string;
              const signedAt = new Date(timestamp).getTime();
              const now = Date.now();
              const daysElapsed = (now - signedAt) / (1000 * 60 * 60 * 24);
              return daysElapsed > 365;
            }, 'isExpired');

            return branch(bp,
              (bindings) => bindings.isExpired as boolean,
              (expP) => complete(expP, 'expired', { message: 'Certificate has expired' }),
              (okP) => {
                // Check trust
                okP = mapBindings(okP, (bindings) => {
                  const record = bindings.sigRecord as Record<string, unknown>;
                  return record.signer as string;
                }, 'signerIdentity');

                okP = find(okP, 'signature-trusted', {}, 'allTrusted');

                return branch(okP,
                  (bindings) => {
                    const signer = bindings.signerIdentity as string;
                    const trusted = bindings.allTrusted as Record<string, unknown>[];
                    return !trusted.some(t => t.identity === signer);
                  },
                  (untP) => completeFrom(untP, 'untrustedSigner', (bindings) => ({
                    signer: bindings.signerIdentity as string,
                  })),
                  (valP) => completeFrom(valP, 'valid', (bindings) => {
                    const record = bindings.sigRecord as Record<string, unknown>;
                    return {
                      identity: record.signer as string,
                      timestamp: record.timestamp as string,
                    };
                  }),
                );
              },
            );
          },
        );
      },
      (elseP) => complete(elseP, 'invalid', { message: 'Signature not found' }),
    ) as StorageProgram<Result>;
  },

  timestamp(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const timestamp = new Date().toISOString();
    const nonce = `nonce-${++nonceCounter}-${Date.now()}`;
    const proofData = `proof-${contentHash}-${timestamp}`;

    const proof = JSON.stringify({
      contentHash,
      timestamp,
      nonce,
      proof: proofData,
      authority: 'tsa-authority',
    });

    let p = createProgram();
    return complete(p, 'ok', { proof }) as StorageProgram<Result>;
  },
};

// All actions are fully functional — no imperative overrides needed.
export const signatureHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSignatureCounter(): void {
  idCounter = 0;
  nonceCounter = 0;
}
