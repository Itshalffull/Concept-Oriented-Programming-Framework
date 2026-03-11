// ============================================================
// AbiDecoderFieldMapping Handler
//
// Translate Ethereum ABI-encoded contract call results and event
// logs into structured entity fields, and reverse-translate entity
// fields into ABI-encoded call data for write operations.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `abi-map-${++idCounter}`;
}

export const abiDecoderFieldMappingHandler: ConceptHandler = {
  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const mapper = input.mapper as string;
    const contract = input.contract as string;

    if (!mapper) {
      return { variant: 'error', message: 'mapper is required' };
    }

    const existing = await storage.get('abi_decoder_field_mapping', mapper);
    if (!existing) {
      return { variant: 'notfound', mapper };
    }

    if (!data) {
      return { variant: 'error', message: 'data is required' };
    }
    if (!contract) {
      return { variant: 'error', message: 'contract is required' };
    }

    // Simulate ABI decoding and field mapping
    let fieldRules: Record<string, unknown>;
    try {
      fieldRules = JSON.parse(String(existing['field_rules'] || '{}'));
    } catch {
      return { variant: 'error', message: 'Invalid field_rules in mapping' };
    }

    const mapped = JSON.stringify({
      source_contract: contract,
      decoded_fields: fieldRules,
      raw_data: data,
    });

    return { variant: 'ok', mapped };
  },

  async reverse(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const mapper = input.mapper as string;

    if (!mapper) {
      return { variant: 'error', message: 'mapper is required' };
    }

    const existing = await storage.get('abi_decoder_field_mapping', mapper);
    if (!existing) {
      return { variant: 'notfound', mapper };
    }

    if (!data) {
      return { variant: 'error', message: 'data is required' };
    }

    // Validate entity data
    let entityData: Record<string, unknown>;
    try {
      entityData = JSON.parse(data);
    } catch {
      return { variant: 'error', message: 'Invalid entity data JSON' };
    }

    // Simulate reverse encoding
    const encoded = `0x${Buffer.from(JSON.stringify(entityData)).toString('hex')}`;

    return { variant: 'ok', encoded };
  },

  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const contract_abi = input.contract_abi as string;
    const entity_schema = input.entity_schema as string;
    const field_rules = input.field_rules as string;

    if (!contract_abi) {
      return { variant: 'invalid', message: 'contract_abi is required' };
    }
    if (!entity_schema) {
      return { variant: 'invalid', message: 'entity_schema is required' };
    }
    if (!field_rules) {
      return { variant: 'invalid', message: 'field_rules is required' };
    }

    // Validate ABI JSON
    try {
      JSON.parse(contract_abi);
    } catch {
      return { variant: 'invalid', message: 'contract_abi is not valid JSON' };
    }

    // Validate field rules JSON
    try {
      JSON.parse(field_rules);
    } catch {
      return { variant: 'invalid', message: 'field_rules is not valid JSON' };
    }

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('abi_decoder_field_mapping', id, {
      id,
      contract_abi,
      entity_schema,
      field_rules,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok', mapper: id };
  },
};

/** Reset internal state. Useful for testing. */
export function resetAbiDecoderFieldMapping(): void {
  idCounter = 0;
}
