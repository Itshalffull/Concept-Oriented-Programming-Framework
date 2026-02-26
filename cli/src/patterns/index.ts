// ============================================================
// Pattern Validator Framework
//
// Each pattern validator is a function:
//   (ast: ConceptAST) => ValidationResult
//
// Validators live in this directory and are registered by name.
// The `copf check --pattern <name> <concept>` command dispatches
// to the named validator.
//
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptAST } from '../../../kernel/src/types.js';
import { asyncGateValidator } from './async-gate.js';

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ValidationResult {
  pattern: string;
  messages: ValidationMessage[];
}

export type PatternValidator = (ast: ConceptAST) => ValidationResult;

const registry = new Map<string, PatternValidator>();

export function registerPattern(name: string, validator: PatternValidator): void {
  registry.set(name, validator);
}

export function getPattern(name: string): PatternValidator | undefined {
  return registry.get(name);
}

export function listPatterns(): string[] {
  return Array.from(registry.keys());
}

// Register built-in patterns
registerPattern('async-gate', asyncGateValidator);
