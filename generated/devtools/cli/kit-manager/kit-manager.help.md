# copf kit-manager — Help

Manage kit **<source>** — scaffold, validate, test, and publish reusable concept packages.


> **When to use:** Use when creating, validating, testing, or managing concept kits. Covers the full kit lifecycle from scaffolding to publishing.


## Design Principles

- **Kit as Reusable Unit:** A kit bundles related concepts and syncs into a single distributable package — like an npm package for COPF.
- **Cross-Kit Isolation:** Concepts in one kit never reference concepts in another kit directly — cross-kit integration happens through syncs and type parameter alignment.
- **Required vs Recommended Syncs:** Kit syncs are tiered: required syncs are load-bearing, recommended syncs provide useful defaults, integration syncs wire to other kits.
**init:**
- [ ] Kit name follows naming convention?
- [ ] Kit.yaml has required fields (name, version, description)?
- [ ] Example concept spec is valid?

**validate:**
- [ ] All concept specs parse successfully?
- [ ] All sync files compile?
- [ ] Cross-kit references resolve?
- [ ] Type parameters align across concepts?

**test:**
- [ ] Conformance tests pass?
- [ ] Integration tests pass?
- [ ] No failing assertions?

**checkOverrides:**
- [ ] Override references valid syncs?
- [ ] Override parameters match original sync signature?
## References

- [Kit manifest and directory structure](references/kit-structure.md)
- [Publishing and versioning kits](references/kit-publishing.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| init | `copf kit init <name>` | Scaffold a new kit |
| validate | `copf kit validate <path>` | Validate kit manifest |
| test | `copf kit test <path>` | Run kit tests |
| list | `copf kit list` | List active kits |
| checkOverrides | `copf kit check-overrides <path>` | Verify sync overrides |


## Anti-Patterns

### Cross-kit concept reference
Kit A's concept imports Kit B's types directly instead of using type parameters.

**Bad:**
```
# In kit-a/concepts/order.concept
concept Order [O] {
  state { customer: O -> kit_b.User }  # Direct reference!
}

```

**Good:**
```
# In kit-a/concepts/order.concept
concept Order [O, U] {
  state { customer: O -> U }  # Type parameter, wired by sync
}

```

### Monolithic kit
Kit bundles unrelated concepts — violates the reusable unit principle.

**Bad:**
```
# kit.yaml
kit: { name: everything }
concepts: [User, Article, Payment, Analytics, Email, Notification]

```

**Good:**
```
# Split into focused kits
kit: { name: content }   # concepts: [Article, Tag, Comment]
kit: { name: commerce }  # concepts: [Payment, Invoice, Refund]

```
## Validation

*Validate a kit:*
```bash
npx tsx tools/copf-cli/src/index.ts kit validate ./kits/my-kit
```
*Run kit tests:*
```bash
npx tsx tools/copf-cli/src/index.ts kit test ./kits/my-kit
```
*List active kits:*
```bash
npx tsx tools/copf-cli/src/index.ts kit list
```
## Related Skills

- /concept-designer — Design concepts to include in the kit
- /sync-designer — Write syncs that wire kit concepts together
- /deployment-config — Deploy kits to production runtimes
