# Bind namespaceStrategy — Design Note (MAG-586)

Interface manifests should declare how namespace is passed in API requests:

```yaml
targets:
  rest:
    namespaceStrategy: header    # X-Namespace: tenant:acme
  graphql:
    namespaceStrategy: query     # $namespace variable
  mcp:
    namespaceStrategy: header    # X-Namespace header on tool calls
```

Strategies:
- `header` — `X-Namespace: tenant:acme` (cleanest, default)
- `path` — `/api/tenants/acme/content/...` (bookmarkable, admin APIs)
- `query` — `?namespace=tenant:acme` (simplest)

Auth middleware extracts tenant from credentials and sets header automatically.
Explicit override via path/query for cross-tenant admin access.

This is a Bind generator change — tracked for when the interface
generation pipeline supports target-level configuration options.
