# Publishing and Versioning Kits

## Versioning

Kits follow semantic versioning:
- **Major** — Breaking changes to concept specs or required syncs.
- **Minor** — New concepts, new optional syncs, new actions.
- **Patch** — Bug fixes, documentation, implementation improvements.

## Publishing Workflow

1. **Validate** — `copf kit validate ./kits/my-kit`
2. **Test** — `copf kit test ./kits/my-kit`
3. **Version** — Update `kit.yaml` version field.
4. **Package** — `copf kit pack ./kits/my-kit`
5. **Publish** — `copf kit publish ./kits/my-kit`

## Registry

Kits are published to a registry (npm-compatible):

```bash
# Publish to default registry
copf kit publish ./kits/my-kit

# Publish to custom registry
copf kit publish ./kits/my-kit --registry https://my-registry.com
```

## Installing Kits

```bash
copf kit add auth@1.0.0
```

This adds the kit to the project's `copf.config.yaml`:

```yaml
kits:
  - name: auth
    version: 1.0.0
    overrides:
      syncs:
        - syncs/custom-profile.sync  # Override recommended sync
```

## Breaking Change Guidelines

When making a breaking change:
1. Bump major version.
2. Document migration steps.
3. Provide a migration sync if state schema changed.
