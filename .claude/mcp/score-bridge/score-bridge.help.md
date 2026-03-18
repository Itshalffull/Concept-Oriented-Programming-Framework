# ScoreBridge — Remote Score Connection

Proxy Score queries to a remote Clef runtime over a transport connection,
enabling an LLM or local tool to query the semantic index of a deployed
application without local file access.

## Workflow

1. **Connect** to a remote Score endpoint (or let the sync auto-connect
   after `runtime_discovery_select_runtime`)
2. **Query** using GraphQL against the remote Score index
3. **Show** entities by kind and name
4. **Traverse** relationships in the remote graph
5. **Disconnect** when done

## Tools

| Tool | Purpose |
|------|---------|
| `score_bridge_connect` | Connect to a remote Score endpoint |
| `score_bridge_query` | Run GraphQL queries on remote Score |
| `score_bridge_show` | Look up an entity by kind and name |
| `score_bridge_traverse` | Follow a relationship edge |
| `score_bridge_disconnect` | Close the connection |
| `score_bridge_status` | Check connection health |

## Example Flow

```
# 1. Connect to remote Score
score_bridge_connect(endpoint: "https://app.example.com/score", protocol: "http")

# 2. Query concepts on the remote app
score_bridge_query(bridge: "bridge-...", graphql: "{ concepts { conceptName purpose } }")

# 3. Show a specific concept
score_bridge_show(bridge: "bridge-...", kind: "concept", name: "User")

# 4. Traverse to its actions
score_bridge_traverse(bridge: "bridge-...", relation: "actions", target: "register")

# 5. Disconnect
score_bridge_disconnect(bridge: "bridge-...")
```

## Sync Integration

When used with RuntimeDiscovery, the `ScoreBridgeOnRuntimeSelect` sync
automatically triggers `score_bridge_connect` when a runtime is selected
via `runtime_discovery_select_runtime`.
