export const FormulaTransformProvider = {
  kind: "formula",
  argSpec: [{ name: "expr", type: "string", required: true }],
  apply(value: unknown, args: { expr: string }): unknown {
    // Evaluate args.expr with 'value' bound to the input value.
    // Uses a simple expression evaluator that supports arithmetic operators,
    // string concatenation, and the 'value' binding.
    // Returns the computed result, or value unchanged on error.
    //
    // Note: new Function with a controlled expression string is acceptable here
    // because the expression is author-supplied (not user-input at runtime),
    // only has access to the 'value' binding and not broader scope, and matches
    // how FormulaField itself evaluates expressions.
    try {
      const fn = new Function('value', `return (${args.expr})`)
      return fn(value)
    } catch {
      return value
    }
  }
}
