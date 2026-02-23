# Walkthrough: Building for Production

This walkthrough shows how to build a production-ready
cache from your concept specs and syncs.

## Step 1: Validate Everything

```bash
copf check           # Validate all specs
copf compile-syncs   # Validate all syncs
```

## Step 2: Build the Cache

```bash
copf compile --cache --verbose
```

```
Building cache...
[cache] user.concept → manifests/user.manifest.json (new)
[cache] article.concept → manifests/article.manifest.json (new)
[cache] create-profile.sync → syncs/create-profile.compiled.js (new)
[cache] types → types/user.d.ts, types/article.d.ts (new)
Cache built: 4 manifests, 2 syncs, 4 type files
```

## Step 3: Deploy

Include `.copf-cache/` in your deployment:

```dockerfile
COPY .copf-cache/ /app/.copf-cache/
```

The runtime loads pre-compiled artifacts on startup,
skipping the parse/compile step entirely.
