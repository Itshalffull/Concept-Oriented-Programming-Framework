// ============================================================
// Mock Handler Generator
//
// createMockHandler: generates a ConceptHandler from a ConceptAST
// where every action returns its first (ok) variant by default,
// with deterministic test values for output fields.
//
// See Architecture doc Section 16.4.
// ============================================================

import type {
  ConceptAST,
  ConceptHandler,
  TypeExpr,
  ConceptStorage,
} from '../../../runtime/types.js';

type ActionHandler = (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => Promise<{ variant: string; [key: string]: unknown }>;

/**
 * Generate a mock ConceptHandler from a ConceptAST.
 *
 * Every action returns its first (ok) variant by default, with
 * deterministic test values for output fields. Override specific
 * actions by passing an overrides map.
 *
 * Example:
 *   const mockJwt = createMockHandler(jwtAst, {
 *     verify: async (input) => ({
 *       variant: "expired",
 *       message: "token expired",
 *     })
 *   });
 */
export function createMockHandler(
  ast: ConceptAST,
  overrides?: Partial<Record<string, ActionHandler>>,
): ConceptHandler {
  const handler: ConceptHandler = {};

  for (const action of ast.actions) {
    if (overrides && overrides[action.name]) {
      handler[action.name] = overrides[action.name]!;
      continue;
    }

    // Generate default handler returning the first variant (typically "ok")
    const defaultVariant = action.variants[0];
    if (!defaultVariant) continue;

    handler[action.name] = async (input: Record<string, unknown>) => {
      const result: Record<string, unknown> = {
        variant: defaultVariant.name,
      };

      // Populate output fields with deterministic test values
      for (const param of defaultVariant.params) {
        // If the input contains a field with the same name, echo it back
        if (param.name in input) {
          result[param.name] = input[param.name];
        } else {
          result[param.name] = generateTestValue(param.type, param.name);
        }
      }

      return result as { variant: string; [key: string]: unknown };
    };
  }

  return handler;
}

/**
 * Generate a deterministic test value for a given type expression.
 * Uses the same logic as conformance test generation (Section 7.4).
 */
function generateTestValue(type: TypeExpr, fieldName: string): unknown {
  switch (type.kind) {
    case 'primitive':
      return generatePrimitiveTestValue(type.name, fieldName);
    case 'param':
      // Type parameters are strings on the wire
      return `test-${fieldName}-001`;
    case 'set':
      return [generateTestValue(type.inner, fieldName)];
    case 'list':
      return [generateTestValue(type.inner, fieldName)];
    case 'option':
      return generateTestValue(type.inner, fieldName);
    case 'relation':
      return {};
    case 'record': {
      const obj: Record<string, unknown> = {};
      for (const f of type.fields) {
        obj[f.name] = generateTestValue(f.type, f.name);
      }
      return obj;
    }
    default:
      return `test-${fieldName}`;
  }
}

/**
 * Generate a deterministic test value for a primitive type.
 */
function generatePrimitiveTestValue(
  typeName: string,
  fieldName: string,
): unknown {
  switch (typeName.toLowerCase()) {
    case 'string':
      return `test-${fieldName}-001`;
    case 'int':
    case 'integer':
    case 'number':
      return 42;
    case 'bool':
    case 'boolean':
      return true;
    case 'float':
    case 'double':
      return 3.14;
    default:
      return `test-${fieldName}-001`;
  }
}
