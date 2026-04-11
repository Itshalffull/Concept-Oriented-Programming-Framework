'use client';

/**
 * OperatorDropdown — context-sensitive operator picker.
 * Per surface/widgets/operator-dropdown.widget.
 *
 * Changes available operators based on field type:
 *   text/string  → is, isNot, contains, notContains, startsWith, endsWith, isEmpty, isNotEmpty
 *   number       → eq, neq, gt, gte, lt, lte, isEmpty, isNotEmpty
 *   date         → before, after, on, between, isEmpty, isNotEmpty
 *   boolean      → is (true/false)
 *   select       → is, isNot, isEmpty, isNotEmpty
 *   multi-select → contains, notContains, isEmpty, isNotEmpty
 */

import React from 'react';

export type FieldType = 'text' | 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multi-select';

interface OperatorOption {
  value: string;
  label: string;
  isUnary?: boolean;
}

const OPERATORS_BY_TYPE: Record<FieldType, OperatorOption[]> = {
  text: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
  string: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
  date: [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'on', label: 'on' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
  boolean: [
    { value: 'eq', label: 'is' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
  'multi-select': [
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'isEmpty', label: 'is empty', isUnary: true },
    { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
  ],
};

const DEFAULT_OPERATORS: OperatorOption[] = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'isEmpty', label: 'is empty', isUnary: true },
  { value: 'isNotEmpty', label: 'is not empty', isUnary: true },
];

export function getOperatorsForType(fieldType: FieldType): OperatorOption[] {
  return OPERATORS_BY_TYPE[fieldType] ?? DEFAULT_OPERATORS;
}

export function isUnaryOperator(operator: string, fieldType: FieldType): boolean {
  const ops = getOperatorsForType(fieldType);
  const op = ops.find((o) => o.value === operator);
  return op?.isUnary ?? false;
}

interface OperatorDropdownProps {
  fieldType: FieldType;
  currentOperator: string;
  onChange: (operator: string) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export const OperatorDropdown: React.FC<OperatorDropdownProps> = ({
  fieldType,
  currentOperator,
  onChange,
}) => {
  const operators = getOperatorsForType(fieldType);
  const effectiveOperator = operators.some((o) => o.value === currentOperator)
    ? currentOperator
    : operators[0]?.value ?? 'eq';

  return (
    <select
      data-part="root"
      value={effectiveOperator}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
    >
      {operators.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  );
};

export default OperatorDropdown;
