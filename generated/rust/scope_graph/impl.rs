use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ScopeGraphHandler;
use serde_json::json;

pub struct ScopeGraphHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("scope-graph-{}-{}", t.as_secs(), t.subsec_nanos())
}

fn next_scope_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("scope-{}", t.subsec_nanos())
}

/// Build a scope graph from a JSON-encoded syntax tree.
fn build_scope_graph_from_tree(file: &str, tree_json: &str) -> serde_json::Value {
    let tree: serde_json::Value = match serde_json::from_str(tree_json) {
        Ok(v) => v,
        Err(_) => {
            let global_id = next_scope_id();
            return json!({
                "scopes": [{"id": global_id, "kind": "global", "name": file, "parentId": null}],
                "declarations": [],
                "references": [],
                "importEdges": [],
                "language": "unknown"
            });
        }
    };

    let language = tree.get("language").and_then(|v| v.as_str()).unwrap_or("unknown");
    let nodes = tree.get("nodes").and_then(|v| v.as_array());

    let global_id = next_scope_id();
    let mut scopes = vec![json!({"id": global_id, "kind": "module", "name": file, "parentId": null})];
    let mut declarations = Vec::new();
    let mut references = Vec::new();
    let mut import_edges = Vec::new();

    if let Some(nodes) = nodes {
        for node in nodes {
            let node_type = node.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let node_name = node.get("name").and_then(|v| v.as_str()).unwrap_or("");

            match node_type {
                "scope" => {
                    let sid = next_scope_id();
                    scopes.push(json!({
                        "id": sid,
                        "kind": node.get("scopeKind").and_then(|v| v.as_str()).unwrap_or("block"),
                        "name": node_name,
                        "parentId": node.get("parentScope").and_then(|v| v.as_str()).unwrap_or(&global_id)
                    }));
                }
                "declaration" => {
                    declarations.push(json!({
                        "name": node_name,
                        "symbolString": node.get("symbolString").and_then(|v| v.as_str()).unwrap_or(""),
                        "scopeId": node.get("scopeId").and_then(|v| v.as_str()).unwrap_or(&global_id),
                        "kind": node.get("declKind").and_then(|v| v.as_str()).unwrap_or("variable")
                    }));
                }
                "reference" => {
                    references.push(json!({
                        "name": node_name,
                        "scopeId": node.get("scopeId").and_then(|v| v.as_str()).unwrap_or(&global_id),
                        "resolved": node.get("resolved").and_then(|v| v.as_str())
                    }));
                }
                "import" => {
                    import_edges.push(json!({
                        "importedName": node_name,
                        "fromModule": node.get("fromModule").and_then(|v| v.as_str()).unwrap_or(""),
                        "scopeId": node.get("scopeId").and_then(|v| v.as_str()).unwrap_or(&global_id),
                        "resolvedSymbol": node.get("resolvedSymbol").and_then(|v| v.as_str())
                    }));
                }
                _ => {}
            }
        }
    }

    let unresolved_count = references.iter()
        .filter(|r| r.get("resolved").map_or(true, |v| v.is_null()))
        .count();

    json!({
        "scopes": scopes,
        "declarations": declarations,
        "references": references,
        "importEdges": import_edges,
        "language": language,
        "unresolvedCount": unresolved_count
    })
}

/// Resolve a name by walking up the scope chain.
fn resolve_in_chain(
    name: &str,
    scope_id: &str,
    scopes: &[serde_json::Value],
    declarations: &[serde_json::Value],
    import_edges: &[serde_json::Value],
) -> (Option<String>, Vec<String>) {
    let scope_map: std::collections::HashMap<&str, &serde_json::Value> = scopes.iter()
        .filter_map(|s| s.get("id").and_then(|v| v.as_str()).map(|id| (id, s)))
        .collect();

    let mut candidates = Vec::new();
    let mut current = Some(scope_id.to_string());

    while let Some(sid) = &current {
        let scope_decls: Vec<_> = declarations.iter()
            .filter(|d| d.get("scopeId").and_then(|v| v.as_str()) == Some(sid) &&
                       d.get("name").and_then(|v| v.as_str()) == Some(name))
            .collect();

        if scope_decls.len() == 1 {
            let sym = scope_decls[0].get("symbolString").and_then(|v| v.as_str()).unwrap_or("");
            return (Some(sym.to_string()), Vec::new());
        }
        if scope_decls.len() > 1 {
            return (None, scope_decls.iter()
                .filter_map(|d| d.get("symbolString").and_then(|v| v.as_str()).map(String::from))
                .collect());
        }

        // Check imports
        let scope_imports: Vec<_> = import_edges.iter()
            .filter(|e| e.get("scopeId").and_then(|v| v.as_str()) == Some(sid) &&
                       e.get("importedName").and_then(|v| v.as_str()) == Some(name))
            .collect();
        if scope_imports.len() == 1 {
            if let Some(resolved) = scope_imports[0].get("resolvedSymbol").and_then(|v| v.as_str()) {
                return (Some(resolved.to_string()), Vec::new());
            }
        }
        for imp in &scope_imports {
            if let Some(rs) = imp.get("resolvedSymbol").and_then(|v| v.as_str()) {
                candidates.push(rs.to_string());
            }
        }

        current = scope_map.get(sid.as_str())
            .and_then(|s| s.get("parentId").and_then(|v| v.as_str()).map(String::from));
    }

    (None, candidates)
}

#[async_trait]
impl ScopeGraphHandler for ScopeGraphHandlerImpl {
    async fn build(
        &self,
        input: ScopeGraphBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphBuildOutput, Box<dyn std::error::Error>> {
        let graph_data = build_scope_graph_from_tree(&input.file, &input.tree);
        let id = next_id();

        storage.put("scope-graph", &id, json!({
            "id": id,
            "file": input.file,
            "scopes": serde_json::to_string(&graph_data["scopes"])?,
            "declarations": serde_json::to_string(&graph_data["declarations"])?,
            "references": serde_json::to_string(&graph_data["references"])?,
            "importEdges": serde_json::to_string(&graph_data["importEdges"])?,
            "scopeCount": graph_data["scopes"].as_array().map(|a| a.len()).unwrap_or(0),
            "declarationCount": graph_data["declarations"].as_array().map(|a| a.len()).unwrap_or(0),
            "unresolvedCount": graph_data["unresolvedCount"],
            "language": graph_data["language"]
        })).await?;

        Ok(ScopeGraphBuildOutput::Ok { graph: id })
    }

    async fn resolve_reference(
        &self,
        input: ScopeGraphResolveReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphResolveReferenceOutput, Box<dyn std::error::Error>> {
        let record = storage.get("scope-graph", &input.graph).await?;
        if record.is_none() {
            return Ok(ScopeGraphResolveReferenceOutput::Unresolved { candidates: "[]".to_string() });
        }
        let record = record.unwrap();

        let scopes: Vec<serde_json::Value> = serde_json::from_str(
            record.get("scopes").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;
        let declarations: Vec<serde_json::Value> = serde_json::from_str(
            record.get("declarations").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;
        let import_edges: Vec<serde_json::Value> = serde_json::from_str(
            record.get("importEdges").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        let (resolved, candidates) = resolve_in_chain(&input.name, &input.scope, &scopes, &declarations, &import_edges);

        if let Some(symbol) = resolved {
            Ok(ScopeGraphResolveReferenceOutput::Ok { symbol })
        } else if candidates.len() > 1 {
            Ok(ScopeGraphResolveReferenceOutput::Ambiguous {
                symbols: serde_json::to_string(&candidates)?,
            })
        } else {
            Ok(ScopeGraphResolveReferenceOutput::Unresolved {
                candidates: serde_json::to_string(&candidates)?,
            })
        }
    }

    async fn visible_symbols(
        &self,
        input: ScopeGraphVisibleSymbolsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphVisibleSymbolsOutput, Box<dyn std::error::Error>> {
        let record = storage.get("scope-graph", &input.graph).await?;
        if record.is_none() {
            return Ok(ScopeGraphVisibleSymbolsOutput::Ok { symbols: "[]".to_string() });
        }
        let record = record.unwrap();

        let scopes: Vec<serde_json::Value> = serde_json::from_str(
            record.get("scopes").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;
        let declarations: Vec<serde_json::Value> = serde_json::from_str(
            record.get("declarations").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        let scope_map: std::collections::HashMap<&str, &serde_json::Value> = scopes.iter()
            .filter_map(|s| s.get("id").and_then(|v| v.as_str()).map(|id| (id, s)))
            .collect();

        let mut visible = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut current = Some(input.scope.clone());

        while let Some(sid) = &current {
            for d in &declarations {
                if d.get("scopeId").and_then(|v| v.as_str()) == Some(sid) {
                    let name = d.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    if seen.insert(name.to_string()) {
                        visible.push(json!({
                            "name": name,
                            "symbolString": d.get("symbolString").and_then(|v| v.as_str()).unwrap_or(""),
                            "kind": d.get("kind").and_then(|v| v.as_str()).unwrap_or("")
                        }));
                    }
                }
            }
            current = scope_map.get(sid.as_str())
                .and_then(|s| s.get("parentId").and_then(|v| v.as_str()).map(String::from));
        }

        Ok(ScopeGraphVisibleSymbolsOutput::Ok {
            symbols: serde_json::to_string(&visible)?,
        })
    }

    async fn resolve_cross_file(
        &self,
        input: ScopeGraphResolveCrossFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphResolveCrossFileOutput, Box<dyn std::error::Error>> {
        let record = storage.get("scope-graph", &input.graph).await?;
        if record.is_none() {
            return Ok(ScopeGraphResolveCrossFileOutput::NoUnresolved);
        }
        let record = record.unwrap();

        let mut references: Vec<serde_json::Value> = serde_json::from_str(
            record.get("references").and_then(|v| v.as_str()).unwrap_or("[]")
        )?;

        let unresolved: Vec<_> = references.iter()
            .filter(|r| r.get("resolved").map_or(true, |v| v.is_null()))
            .cloned()
            .collect();

        if unresolved.is_empty() {
            return Ok(ScopeGraphResolveCrossFileOutput::NoUnresolved);
        }

        // Try resolving against other scope graphs
        let all_graphs = storage.find("scope-graph", None).await?;
        let mut resolved_count = 0i64;

        for ref_entry in &mut references {
            if !ref_entry.get("resolved").map_or(true, |v| v.is_null()) { continue; }
            let ref_name = ref_entry.get("name").and_then(|v| v.as_str()).unwrap_or("");

            for other in &all_graphs {
                let other_id = other.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if other_id == input.graph { continue; }

                let other_decls: Vec<serde_json::Value> = serde_json::from_str(
                    other.get("declarations").and_then(|v| v.as_str()).unwrap_or("[]")
                ).unwrap_or_default();

                if let Some(d) = other_decls.iter().find(|d| d.get("name").and_then(|v| v.as_str()) == Some(ref_name)) {
                    ref_entry["resolved"] = json!(d.get("symbolString").and_then(|v| v.as_str()).unwrap_or(""));
                    resolved_count += 1;
                    break;
                }
            }
        }

        let new_unresolved = references.iter().filter(|r| r.get("resolved").map_or(true, |v| v.is_null())).count();
        let mut updated = record.clone();
        updated["references"] = json!(serde_json::to_string(&references)?);
        updated["unresolvedCount"] = json!(new_unresolved);
        storage.put("scope-graph", &input.graph, updated).await?;

        Ok(ScopeGraphResolveCrossFileOutput::Ok { resolved_count })
    }

    async fn get(
        &self,
        input: ScopeGraphGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScopeGraphGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("scope-graph", &input.graph).await?;
        match record {
            Some(r) => Ok(ScopeGraphGetOutput::Ok {
                graph: r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                file: r.get("file").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                scope_count: r.get("scopeCount").and_then(|v| v.as_i64()).unwrap_or(0),
                declaration_count: r.get("declarationCount").and_then(|v| v.as_i64()).unwrap_or(0),
                unresolved_count: r.get("unresolvedCount").and_then(|v| v.as_i64()).unwrap_or(0),
            }),
            None => Ok(ScopeGraphGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_with_invalid_tree() {
        let storage = InMemoryStorage::new();
        let handler = ScopeGraphHandlerImpl;
        let result = handler.build(
            ScopeGraphBuildInput { file: "test.ts".to_string(), tree: "not-json".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScopeGraphBuildOutput::Ok { graph } => {
                assert!(graph.starts_with("scope-graph-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_reference_no_graph() {
        let storage = InMemoryStorage::new();
        let handler = ScopeGraphHandlerImpl;
        let result = handler.resolve_reference(
            ScopeGraphResolveReferenceInput {
                graph: "missing".to_string(),
                name: "x".to_string(),
                scope: "global".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ScopeGraphResolveReferenceOutput::Unresolved { .. } => {},
            _ => panic!("Expected Unresolved variant"),
        }
    }

    #[tokio::test]
    async fn test_visible_symbols_no_graph() {
        let storage = InMemoryStorage::new();
        let handler = ScopeGraphHandlerImpl;
        let result = handler.visible_symbols(
            ScopeGraphVisibleSymbolsInput { graph: "missing".to_string(), scope: "s".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScopeGraphVisibleSymbolsOutput::Ok { symbols } => {
                assert_eq!(symbols, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_resolve_cross_file_no_unresolved() {
        let storage = InMemoryStorage::new();
        let handler = ScopeGraphHandlerImpl;
        let result = handler.resolve_cross_file(
            ScopeGraphResolveCrossFileInput { graph: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScopeGraphResolveCrossFileOutput::NoUnresolved => {},
            _ => panic!("Expected NoUnresolved variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScopeGraphHandlerImpl;
        let result = handler.get(
            ScopeGraphGetInput { graph: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScopeGraphGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
