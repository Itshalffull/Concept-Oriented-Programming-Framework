# Deployment Validation Rules

All validation rules applied by the deployment validator, with error messages and resolution guidance.

## Running Validation

```bash
npx tsx cli/src/index.ts deploy --manifest app.deploy.json
npx tsx cli/src/index.ts deploy --manifest app.deploy.json --specs specs
```

The validator parses the manifest, loads concept specs, and checks all rules. On success, it produces a deployment plan. On failure, it reports errors and exits with code 1.

## Rule 1: Concept Deployment Entries

**Check**: Every concept referenced by a sync has a corresponding entry in the `concepts` section.

**Error message**:
```
Sync "syncs/auth.sync" references concept "JWT" which has no deployment entry
```

**Cause**: A sync file uses `JWT/verify` or similar, but there's no `JWT` entry under `concepts` in the manifest.

**Fix**: Add the concept to the manifest:
```yaml
concepts:
  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./implementations/jwt
        runtime: server
        storage: memory
        queryMode: lite
```

## Rule 2: Capability Requirements

**Check**: Every concept's declared capabilities (from the spec's `capabilities` section) are provided by the target runtime's type.

**Error message**:
```
Concept "Password" requires capability "crypto" but runtime "web" (browser) does not provide it
```

**Cause**: The Password concept spec declares `capabilities { requires crypto }` but is deployed to a `browser` runtime, which does not provide `crypto`.

**Fix**: Either:
1. Move the concept to a compatible runtime (e.g., `node` which provides `crypto`)
2. Create a separate implementation for the browser that doesn't need crypto (use a server-side proxy instead)

**Capability mapping**:

| Runtime Type | Capabilities |
|-------------|-------------|
| `node` | crypto, fs, network, database, full-compute |
| `swift` | crypto, coredata, network, ui |
| `browser` | network, ui, localstorage |
| `embedded` | crypto, minimal-compute |

## Rule 3: Undefined Runtime Reference

**Check**: Every concept implementation references a runtime that exists in the `runtimes` section.

**Error message**:
```
Concept "Password" references runtime "api" which is not defined
```

**Cause**: An implementation's `runtime: api` field doesn't match any key in `runtimes`.

**Fix**: Either add the runtime or fix the typo:
```yaml
runtimes:
  api:                    # Add this runtime
    type: node
    engine: true
    transport: in-process
```

## Rule 4: Sync Engine Assignment

**Check**: Every sync's `engine` field references a runtime that has `engine: true`.

**Error message** (runtime not defined):
```
Sync "syncs/auth.sync" assigned to engine "api" which is not a defined runtime
```

**Error message** (runtime exists but not an engine):
```
Sync "syncs/auth.sync" assigned to runtime "worker" which does not have engine: true
```

**Cause**: The sync points to a runtime that either doesn't exist or isn't configured as an engine.

**Fix**: Either set `engine: true` on the target runtime or reassign the sync:
```yaml
runtimes:
  worker:
    type: node
    engine: true          # Add this
    transport: in-process
```

## Rule 5: Cross-Runtime Eager Sync Warning

**Check**: Eager syncs (no annotations or `[eager]` annotation) that reference concepts deployed on multiple runtimes.

**Warning message**:
```
Eager sync "syncs/profile-sync.sync" spans multiple runtimes: server, ios. Consider marking as [eventual] if latency is a concern.
```

**Cause**: An eager sync references concepts on both `server` and `ios`. Since eager syncs require all concepts to be reachable, this sync will **fail** if the ios runtime is offline.

**Fix**: Either:
1. Mark the sync as `[eventual]` for resilience:
   ```yaml
   syncs:
     - path: ./syncs/profile-sync.sync
       engine: server
       annotations:
         - eventual
   ```
2. Keep it eager if you're certain both runtimes will always be reachable (accept the warning)

**Note**: This is a warning, not an error. The deployment is still valid.

## Rule 6: Upstream Reference Validation

**Check**: Every runtime's `upstream` field references a defined runtime. The hierarchy must be acyclic.

**Error message** (undefined upstream):
```
Runtime "ios" references upstream "api-server" which is not defined
```

**Error message** (cycle detected):
```
Runtime hierarchy has a cycle involving "ios"
```

**Cause**: Either the upstream runtime doesn't exist, or the upstream chain forms a loop (e.g., A→B→A).

**Fix**:
- For undefined upstream: add the missing runtime or fix the name
- For cycles: restructure the hierarchy. Typical pattern is a tree with one root:
  ```yaml
  runtimes:
    server:          # Root engine (no upstream)
      engine: true
    ios:
      engine: true
      upstream: server    # Points to root
    android:
      engine: true
      upstream: server    # Points to root (not ios)
  ```

## Rule 7: App Metadata

**Check**: The `app` section must have `name`, `version`, and `uri` fields.

**Error message**:
```
Deployment manifest must have app.name, app.version, and app.uri
```

**Fix**:
```yaml
app:
  name: my-app
  version: 0.1.0
  uri: urn:my-app
```

## Deployment Plan Output

When all rules pass (no errors), the validator produces a deployment plan:

### Concept Placements

For each concept implementation:

```
Concept Placements:
  - Password → server
  - Profile → server, ios
  - User → server
```

Each placement includes:
- `concept`: Concept name
- `runtime`: Target runtime
- `language`: Implementation language
- `transport`: Transport protocol (from runtime config)
- `queryMode`: `graphql` or `lite`

### Sync Assignments

For each sync:

```
Sync Assignments:
  - ./syncs/auth.sync → server
  - ./syncs/profile-sync.sync → server [eventual] (cross-runtime)
  - ./syncs/local-profile.sync → ios [local]
```

Each assignment includes:
- `sync`: Sync file path
- `engine`: Engine runtime
- `annotations`: Effective annotations
- `crossRuntime`: `true` if the sync references concepts on multiple runtimes

## Validation Flow

```
1. Parse manifest structure (app, runtimes, concepts, syncs)
   ├─ Fail if app metadata missing (Rule 7)
   └─ Fail if JSON/YAML parse error

2. Load concept specs from specs directory
   └─ Extract capabilities from each concept AST

3. Validate concept deployments
   ├─ Rule 2: Capability check (concept caps ⊆ runtime caps)
   └─ Rule 3: Runtime reference check

4. Validate sync assignments
   ├─ Rule 1: Concept deployment entry check
   ├─ Rule 4: Engine runtime check
   └─ Rule 5: Cross-runtime eager warning

5. Validate runtime hierarchy
   └─ Rule 6: Upstream reference + cycle check

6. If no errors → generate DeploymentPlan
   └─ Concept placements + sync assignments with cross-runtime flags
```
