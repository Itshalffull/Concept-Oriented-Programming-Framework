'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseControllableStateProps<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const nextValue = typeof next === 'function'
        ? (next as (prev: T) => T)(value)
        : next;
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      onChangeRef.current?.(nextValue);
    },
    [isControlled, value]
  );

  return [value, setValue];
}
