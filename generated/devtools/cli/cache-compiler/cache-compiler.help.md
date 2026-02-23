# copf cache-compiler — Help

Build pre-compiled cache artifacts from all concept specs and sync rules for faster startup and deployment.


> **When to use:** Use when building pre-compiled artifacts for deployment or to speed up startup. Parses all specs, generates manifests, compiles syncs, and writes cache files.


## Design Principles

- **Content-Addressed Cache:** Cached artifacts are keyed by content hash — identical input produces identical output, and unchanged files are never rewritten.
- **Complete Compilation:** Cache includes everything needed for deployment — parsed ASTs, generated manifests, compiled syncs, and type information.
**compile:**
- [ ] All concept specs parse without errors?
- [ ] All sync files compile?
- [ ] Cache directory is writable?
- [ ] Previous cache is cleaned or invalidated?
## References

- [Cache compilation and invalidation](references/caching.md)
## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| compile | `copf compile --cache` | Build pre-compiled cache |


## Validation

*Build the cache:*
```bash
npx tsx tools/copf-cli/src/index.ts compile --cache
```
*Verify cache contents:*
```bash
ls -la .copf-cache/
```
## Related Skills

- /concept-validator — Validate specs before caching
- /deployment-config — Deploy using cached artifacts
- /dev-workflow — Dev server uses cache for fast startup
