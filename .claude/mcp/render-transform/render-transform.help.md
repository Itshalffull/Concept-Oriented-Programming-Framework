# render_transform — MCP Tool Guide

Registry and dispatcher for composable render program transformations . Manages named transforms with kind based routing to provider concepts through sync wiring the functorial mapping hub that makes theme switching , a11y variants , and style adaptations composable first class operations without hardcoding transform logic

## Design Principles

- **Functorial Composition:** Theme switching and a11y variants are composable transformations over render programs — not separate code paths. apply(p, compose([f,g])) = apply(apply(p, f), g).
- **Provider Dispatch via Syncs:** Transform kinds (token-remap, a11y-adapt, etc.) are registered as providers and dispatched through sync wiring — zero hardcoding.
**apply:**
- [ ] Transform satisfies functor identity law (empty spec = identity)?
- [ ] Composed transforms satisfy functor composition law?
- [ ] Accessibility transforms preserve WCAG compliance?
- [ ] Theme token remaps cover all referenced tokens?
## References

- [Render transform provider reference](references/render-transform-providers.md)
**Related tools:** [object Object]

