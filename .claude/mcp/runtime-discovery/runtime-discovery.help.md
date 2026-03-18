# RuntimeDiscovery — Deploy Manifest Scanner

Discover Clef deployment manifests within a project directory, extract
the runtimes they declare, and resolve transport endpoints and credential
references for each runtime.

## Workflow

1. **Scan** a project directory to find all `*.deploy.yaml` manifests
2. **List runtimes** to see what's available in each project
3. **Resolve endpoints** to get transport URLs for each runtime
4. **Select a runtime** to prepare it for ScoreBridge connection

## Tools

| Tool | Purpose |
|------|---------|
| `runtime_discovery_scan` | Scan a directory for deploy manifests |
| `runtime_discovery_list_projects` | List all scanned projects |
| `runtime_discovery_list_runtimes` | List runtimes for a project |
| `runtime_discovery_resolve_endpoint` | Get endpoint URL for a runtime |
| `runtime_discovery_resolve_credentials` | Resolve secret references |
| `runtime_discovery_select_runtime` | Select runtime for Score connection |

## Example Flow

```
# 1. Scan the project
runtime_discovery_scan(directory: "/app/clef-base")

# 2. See what runtimes are available
runtime_discovery_list_runtimes(project: "proj-app-clef-base")

# 3. Select a runtime (triggers ScoreBridge connection via sync)
runtime_discovery_select_runtime(project: "proj-app-clef-base", runtime: "vercel")
```
