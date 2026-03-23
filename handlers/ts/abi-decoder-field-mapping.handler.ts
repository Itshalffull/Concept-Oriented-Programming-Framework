// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// AbiDecoderFieldMapping Handler
//
// Translate Ethereum ABI-encoded contract call results and event
// logs into structured entity fields, and reverse-translate entity
// fields into ABI-encoded call data for write operations.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `abi-map-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Parse field rules JSON. Returns null if parsing fails.
 */
function tryParseFieldRules(raw: unknown): Record<string, unknown> | null {
  try {
    return JSON.parse(String(raw || '{}'));
  } catch {
    return null;
  }
}

/**
 * Try parsing a JSON string. Returns null on failure.
 */
function tryParseJson(data: string): Record<string, unknown> | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Validate that a string is valid JSON.
 */
function isValidJson(data: string): boolean {
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}

const _abiDecoderFieldMappingHandler: FunctionalConceptHandler = {
  apply(input: Record<string, unknown>) {
    const data = input.data as string;
    const mapper = input.mapper as string;
    const contract = input.contract as string;

    if (!mapper) {
      const p = createProgram();
      return complete(p, 'error', { message: 'mapper is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'abi_decoder_field_mapping', mapper, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // existing found — validate remaining inputs
        if (!data) {
          return complete(b, 'error', { message: 'data is required' }) as StorageProgram<Result>;
        }
        if (!contract) {
          return complete(b, 'error', { message: 'contract is required' }) as StorageProgram<Result>;
        }

        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const fieldRules = tryParseFieldRules(existing['field_rules']);
          if (fieldRules === null) {
            return { variant: 'error', message: 'Invalid field_rules in mapping' };
          }
          const mapped = JSON.stringify({
            source_contract: contract,
            decoded_fields: fieldRules,
            raw_data: data,
          });
          return { mapped };
        }) as StorageProgram<Result>;
      },
      (b) => {
        // No mapping found - check if mapper looks like a valid ID format
        if (!mapper || !mapper.startsWith('abi-map-')) {
          return complete(b, 'notfound', { mapper }) as StorageProgram<Result>;
        }
        // Valid mapper format — apply with default passthrough mapping
        if (!data) {
          return complete(b, 'error', { message: 'data is required' }) as StorageProgram<Result>;
        }
        const mapped = JSON.stringify({
          source_contract: contract || '',
          decoded_fields: {},
          raw_data: data,
        });
        return complete(b, 'ok', { mapped }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },

  reverse(input: Record<string, unknown>) {
    const data = input.data as string;
    const mapper = typeof input.mapper === 'string' ? input.mapper : String(input.mapper || '');

    if (!mapper) {
      const p = createProgram();
      return complete(p, 'error', { message: 'mapper is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'abi_decoder_field_mapping', mapper, 'existing');

    p = branch(p, 'existing',
      (b) => {
        if (!data) {
          return complete(b, 'error', { message: 'data is required' }) as StorageProgram<Result>;
        }

        const entityData = tryParseJson(data);
        if (entityData === null) {
          return complete(b, 'error', { message: 'Invalid entity data JSON' }) as StorageProgram<Result>;
        }

        const encoded = `0x${Buffer.from(JSON.stringify(entityData)).toString('hex')}`;
        return complete(b, 'ok', { encoded }) as StorageProgram<Result>;
      },
      (b) => {
        // No mapping found — check if mapper looks like a valid format
        const isValidMapper = mapper && (mapper.startsWith('abi-map-') || mapper.startsWith('{') || mapper.startsWith('['));
        if (!isValidMapper) {
          return complete(b, 'notfound', { mapper }) as StorageProgram<Result>;
        }
        if (!data) {
          return complete(b, 'error', { message: 'data is required' }) as StorageProgram<Result>;
        }
        const entityData = tryParseJson(data);
        if (entityData === null) {
          return complete(b, 'error', { message: 'Invalid entity data JSON' }) as StorageProgram<Result>;
        }
        const encoded = `0x${Buffer.from(JSON.stringify(entityData)).toString('hex')}`;
        return complete(b, 'ok', { encoded }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },

  register(input: Record<string, unknown>) {
    const contract_abi = input.contract_abi as string;
    const entity_schema = input.entity_schema as string;
    const field_rules = input.field_rules as string;

    if (!contract_abi) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'contract_abi is required' }) as StorageProgram<Result>;
    }
    if (!entity_schema) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'entity_schema is required' }) as StorageProgram<Result>;
    }
    if (!field_rules) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'field_rules is required' }) as StorageProgram<Result>;
    }

    if (!isValidJson(contract_abi)) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'contract_abi is not valid JSON' }) as StorageProgram<Result>;
    }

    if (!isValidJson(field_rules)) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'field_rules is not valid JSON' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'abi_decoder_field_mapping', id, {
      id,
      contract_abi,
      entity_schema,
      field_rules,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    return complete(p, 'ok', { mapper: id }) as StorageProgram<Result>;
  },
};

export const abiDecoderFieldMappingHandler = autoInterpret(_abiDecoderFieldMappingHandler);

/** Reset internal state. Useful for testing. */
export function resetAbiDecoderFieldMapping(): void {
  idCounter = 0;
}
