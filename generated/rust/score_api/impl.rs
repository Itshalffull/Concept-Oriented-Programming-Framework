use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ScoreApiHandler;
use serde_json::json;

pub struct ScoreApiHandlerImpl;

fn infer_language(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "ts" | "tsx" => "typescript", "js" | "jsx" => "javascript",
        "concept" => "concept-spec", "sync" => "sync-spec",
        "yaml" | "yml" => "yaml", "json" => "json", "md" => "markdown",
        "rs" => "rust", "swift" => "swift", "sol" => "solidity",
        "py" => "python", "go" => "go", "java" => "java",
        "css" => "css", "html" => "html", _ => "unknown",
    }
}

fn infer_role(path: &str) -> &'static str {
    if path.contains("/generated/") { "generated" }
    else if path.contains("/test") || path.ends_with(".test.ts") { "test" }
    else if path.ends_with(".concept") || path.ends_with(".sync") { "spec" }
    else if path.ends_with(".yaml") || path.ends_with(".json") { "config" }
    else if path.ends_with(".md") { "doc" }
    else { "source" }
}

fn match_glob(pattern: &str, path: &str) -> bool {
    if pattern == "*" { return true; }
    let regex_str = pattern
        .replace("**", "<<<DS>>>")
        .replace('*', "[^/]*")
        .replace("<<<DS>>>", ".*")
        .replace('?', ".");
    regex_lite::Regex::new(&format!("^{}$", regex_str))
        .map(|re| re.is_match(path))
        .unwrap_or(path.contains(pattern.trim_matches('*')))
}

#[async_trait]
impl ScoreApiHandler for ScoreApiHandlerImpl {
    async fn list_files(&self, input: ScoreApiListFilesInput, storage: &dyn ConceptStorage) -> Result<ScoreApiListFilesOutput, Box<dyn std::error::Error>> {
        let all = storage.find("files", None).await?;
        let matched: Vec<_> = all.iter().filter(|f| {
            let p = f.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
            match_glob(&input.pattern, p)
        }).collect();
        if matched.is_empty() { return Ok(ScoreApiListFilesOutput::Empty { pattern: input.pattern }); }
        let files: Vec<serde_json::Value> = matched.iter().map(|f| {
            let p = f.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
            json!({"path": p, "language": infer_language(p), "role": infer_role(p), "size": 0})
        }).collect();
        Ok(ScoreApiListFilesOutput::Ok { files: serde_json::to_string(&files)? })
    }

    async fn get_file_tree(&self, input: ScoreApiGetFileTreeInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetFileTreeOutput, Box<dyn std::error::Error>> {
        let all = storage.find("files", None).await?;
        if all.is_empty() { return Ok(ScoreApiGetFileTreeOutput::NotFound { path: input.path }); }
        let file_count = all.len() as i64;
        Ok(ScoreApiGetFileTreeOutput::Ok { tree: format!("{}/", input.path), file_count, dir_count: 1 })
    }

    async fn get_file_content(&self, input: ScoreApiGetFileContentInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetFileContentOutput, Box<dyn std::error::Error>> {
        let key = format!("file:{}", input.path);
        let record = storage.get("files", &key).await?;
        match record {
            Some(r) => Ok(ScoreApiGetFileContentOutput::Ok {
                content: r.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                language: infer_language(&input.path).to_string(),
                definitions: r.get("definitions").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default(),
            }),
            None => Ok(ScoreApiGetFileContentOutput::NotFound { path: input.path }),
        }
    }

    async fn get_definitions(&self, input: ScoreApiGetDefinitionsInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetDefinitionsOutput, Box<dyn std::error::Error>> {
        let symbols = storage.find("symbol", Some(&json!({"file": input.path}))).await?;
        if symbols.is_empty() { return Ok(ScoreApiGetDefinitionsOutput::NotFound { path: input.path }); }
        let defs: Vec<serde_json::Value> = symbols.iter().map(|s| json!({
            "name": s.get("name").and_then(|v| v.as_str()).unwrap_or(""),
            "kind": s.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
            "line": s.get("line").and_then(|v| v.as_i64()).unwrap_or(0),
            "span": s.get("span").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiGetDefinitionsOutput::Ok { definitions: serde_json::to_string(&defs)? })
    }

    async fn match_pattern(&self, input: ScoreApiMatchPatternInput, storage: &dyn ConceptStorage) -> Result<ScoreApiMatchPatternOutput, Box<dyn std::error::Error>> {
        let re = match regex_lite::Regex::new(&input.pattern) {
            Ok(r) => r,
            Err(e) => return Ok(ScoreApiMatchPatternOutput::InvalidPattern { pattern: input.pattern, error: e.to_string() }),
        };
        let all = storage.find("files", None).await?;
        let mut matches = Vec::new();
        for f in &all {
            let content = f.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let path = f.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
            for (i, line) in content.lines().enumerate() {
                if re.is_match(line) {
                    matches.push(json!({"file": path, "line": i+1, "text": line, "context": ""}));
                }
            }
        }
        Ok(ScoreApiMatchPatternOutput::Ok { matches: serde_json::to_string(&matches)? })
    }

    async fn find_symbol(&self, input: ScoreApiFindSymbolInput, storage: &dyn ConceptStorage) -> Result<ScoreApiFindSymbolOutput, Box<dyn std::error::Error>> {
        let results = storage.find("symbol", Some(&json!({"name": input.name}))).await?;
        if results.is_empty() { return Ok(ScoreApiFindSymbolOutput::NotFound { name: input.name }); }
        let symbols: Vec<serde_json::Value> = results.iter().map(|s| json!({
            "name": s.get("name").and_then(|v| v.as_str()).unwrap_or(""),
            "kind": s.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
            "file": s.get("file").and_then(|v| v.as_str()).unwrap_or(""),
            "line": s.get("line").and_then(|v| v.as_i64()).unwrap_or(0),
            "scope": s.get("scope").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiFindSymbolOutput::Ok { symbols: serde_json::to_string(&symbols)? })
    }

    async fn get_references(&self, input: ScoreApiGetReferencesInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetReferencesOutput, Box<dyn std::error::Error>> {
        let refs = storage.find("symbol-reference", Some(&json!({"symbol": input.symbol}))).await?;
        if refs.is_empty() { return Ok(ScoreApiGetReferencesOutput::NotFound { symbol: input.symbol }); }
        let definition = json!({"file": "", "line": 0});
        let references: Vec<serde_json::Value> = refs.iter().map(|r| json!({
            "file": r.get("file").and_then(|v| v.as_str()).unwrap_or(""),
            "line": r.get("line").and_then(|v| v.as_i64()).unwrap_or(0),
            "kind": r.get("kind").and_then(|v| v.as_str()).unwrap_or("usage")
        })).collect();
        Ok(ScoreApiGetReferencesOutput::Ok { definition: definition.to_string(), references: serde_json::to_string(&references)? })
    }

    async fn get_scope(&self, input: ScoreApiGetScopeInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetScopeOutput, Box<dyn std::error::Error>> {
        let scopes = storage.find("scope-graph", Some(&json!({"file": input.file}))).await?;
        if scopes.is_empty() { return Ok(ScoreApiGetScopeOutput::NotFound { file: input.file }); }
        Ok(ScoreApiGetScopeOutput::Ok { scope: "module".to_string(), symbols: serde_json::to_string(&json!([]))?, parent: None })
    }

    async fn get_relationships(&self, input: ScoreApiGetRelationshipsInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetRelationshipsOutput, Box<dyn std::error::Error>> {
        let rels = storage.find("symbol-relationship", Some(&json!({"from": input.symbol}))).await?;
        if rels.is_empty() { return Ok(ScoreApiGetRelationshipsOutput::NotFound { symbol: input.symbol }); }
        let relationships: Vec<serde_json::Value> = rels.iter().map(|r| json!({
            "from": r.get("from").and_then(|v| v.as_str()).unwrap_or(""),
            "to": r.get("to").and_then(|v| v.as_str()).unwrap_or(""),
            "kind": r.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
            "file": r.get("file").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiGetRelationshipsOutput::Ok { relationships: serde_json::to_string(&relationships)? })
    }

    async fn list_concepts(&self, _input: ScoreApiListConceptsInput, storage: &dyn ConceptStorage) -> Result<ScoreApiListConceptsOutput, Box<dyn std::error::Error>> {
        let concepts = storage.find("score-concept", None).await?;
        let list: Vec<serde_json::Value> = concepts.iter().map(|c| json!({
            "name": c.get("name").and_then(|v| v.as_str()).unwrap_or(""),
            "purpose": c.get("purpose").and_then(|v| v.as_str()).unwrap_or(""),
            "actions": c.get("actions").cloned().unwrap_or(json!([])),
            "stateFields": c.get("stateFields").cloned().unwrap_or(json!([])),
            "file": c.get("file").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiListConceptsOutput::Ok { concepts: serde_json::to_string(&list)? })
    }

    async fn get_concept(&self, input: ScoreApiGetConceptInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetConceptOutput, Box<dyn std::error::Error>> {
        let results = storage.find("score-concept", Some(&json!({"name": input.name}))).await?;
        match results.first() {
            Some(c) => Ok(ScoreApiGetConceptOutput::Ok { concept: serde_json::to_string(c)? }),
            None => Ok(ScoreApiGetConceptOutput::NotFound { name: input.name }),
        }
    }

    async fn get_action(&self, input: ScoreApiGetActionInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetActionOutput, Box<dyn std::error::Error>> {
        let results = storage.find("action-entity", Some(&json!({"concept": input.concept, "name": input.action}))).await?;
        match results.first() {
            Some(a) => Ok(ScoreApiGetActionOutput::Ok { action: serde_json::to_string(a)? }),
            None => Ok(ScoreApiGetActionOutput::NotFound { concept: input.concept, action: input.action }),
        }
    }

    async fn list_syncs(&self, _input: ScoreApiListSyncsInput, storage: &dyn ConceptStorage) -> Result<ScoreApiListSyncsOutput, Box<dyn std::error::Error>> {
        let syncs = storage.find("score-sync", None).await?;
        Ok(ScoreApiListSyncsOutput::Ok { syncs: serde_json::to_string(&syncs)? })
    }

    async fn get_sync(&self, input: ScoreApiGetSyncInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetSyncOutput, Box<dyn std::error::Error>> {
        let results = storage.find("score-sync", Some(&json!({"name": input.name}))).await?;
        match results.first() {
            Some(s) => Ok(ScoreApiGetSyncOutput::Ok { sync: serde_json::to_string(s)? }),
            None => Ok(ScoreApiGetSyncOutput::NotFound { name: input.name }),
        }
    }

    async fn get_flow(&self, input: ScoreApiGetFlowInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetFlowOutput, Box<dyn std::error::Error>> {
        let trigger = format!("{}/{}", input.start_concept, input.start_action);
        let flows = storage.find("flow-graph", Some(&json!({"trigger": trigger}))).await?;
        match flows.first() {
            Some(f) => {
                let path_str = f.get("path").and_then(|v| v.as_str()).unwrap_or("[]");
                Ok(ScoreApiGetFlowOutput::Ok { flow: path_str.to_string() })
            }
            None => Ok(ScoreApiGetFlowOutput::NotFound { concept: input.start_concept, action: input.start_action }),
        }
    }

    async fn get_dependencies(&self, input: ScoreApiGetDependenciesInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetDependenciesOutput, Box<dyn std::error::Error>> {
        let deps = storage.find("dependence", Some(&json!({"from": input.symbol}))).await?;
        if deps.is_empty() { return Ok(ScoreApiGetDependenciesOutput::NotFound { symbol: input.symbol }); }
        let direct: Vec<serde_json::Value> = deps.iter().map(|d| json!({
            "name": d.get("to").and_then(|v| v.as_str()).unwrap_or(""),
            "kind": d.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
            "file": d.get("file").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiGetDependenciesOutput::Ok { direct_deps: serde_json::to_string(&direct)?, transitive_deps: "[]".to_string() })
    }

    async fn get_dependents(&self, input: ScoreApiGetDependentsInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetDependentsOutput, Box<dyn std::error::Error>> {
        let deps = storage.find("dependence", Some(&json!({"to": input.symbol}))).await?;
        if deps.is_empty() { return Ok(ScoreApiGetDependentsOutput::NotFound { symbol: input.symbol }); }
        let direct: Vec<serde_json::Value> = deps.iter().map(|d| json!({
            "name": d.get("from").and_then(|v| v.as_str()).unwrap_or(""),
            "kind": d.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
            "file": d.get("file").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiGetDependentsOutput::Ok { direct_deps: serde_json::to_string(&direct)?, transitive_deps: "[]".to_string() })
    }

    async fn get_impact(&self, input: ScoreApiGetImpactInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetImpactOutput, Box<dyn std::error::Error>> {
        let deps = storage.find("dependence", Some(&json!({"file": input.file}))).await?;
        if deps.is_empty() { return Ok(ScoreApiGetImpactOutput::NotFound { file: input.file }); }
        let impact: Vec<serde_json::Value> = deps.iter().map(|d| json!({
            "file": d.get("dependentFile").and_then(|v| v.as_str()).unwrap_or(""),
            "reason": d.get("kind").and_then(|v| v.as_str()).unwrap_or("")
        })).collect();
        Ok(ScoreApiGetImpactOutput::Ok { direct_impact: serde_json::to_string(&impact)?, transitive_impact: "[]".to_string() })
    }

    async fn get_data_flow(&self, input: ScoreApiGetDataFlowInput, storage: &dyn ConceptStorage) -> Result<ScoreApiGetDataFlowOutput, Box<dyn std::error::Error>> {
        let paths = storage.find("data-flow-path", Some(&json!({"from": input.from, "to": input.to}))).await?;
        if paths.is_empty() { return Ok(ScoreApiGetDataFlowOutput::NoPath { from: input.from, to: input.to }); }
        Ok(ScoreApiGetDataFlowOutput::Ok { paths: serde_json::to_string(&paths)? })
    }

    async fn search(&self, input: ScoreApiSearchInput, storage: &dyn ConceptStorage) -> Result<ScoreApiSearchOutput, Box<dyn std::error::Error>> {
        let query_lower = input.query.to_lowercase();
        let all = storage.find("symbol", None).await?;
        let mut results: Vec<serde_json::Value> = all.iter().filter_map(|s| {
            let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.to_lowercase().contains(&query_lower) {
                Some(json!({
                    "name": name,
                    "kind": s.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
                    "file": s.get("file").and_then(|v| v.as_str()).unwrap_or(""),
                    "line": s.get("line").and_then(|v| v.as_i64()).unwrap_or(0),
                    "score": 1.0,
                    "snippet": ""
                }))
            } else { None }
        }).collect();
        if results.is_empty() { return Ok(ScoreApiSearchOutput::Empty { query: input.query }); }
        results.truncate(input.limit.max(1) as usize);
        Ok(ScoreApiSearchOutput::Ok { results: serde_json::to_string(&results)? })
    }

    async fn explain(&self, input: ScoreApiExplainInput, storage: &dyn ConceptStorage) -> Result<ScoreApiExplainOutput, Box<dyn std::error::Error>> {
        let results = storage.find("symbol", Some(&json!({"name": input.symbol}))).await?;
        match results.first() {
            Some(s) => Ok(ScoreApiExplainOutput::Ok {
                summary: format!("{} is a {} defined in {}", input.symbol, s.get("kind").and_then(|v| v.as_str()).unwrap_or("symbol"), s.get("file").and_then(|v| v.as_str()).unwrap_or("")),
                kind: s.get("kind").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                defined_in: s.get("file").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                used_by: Vec::new(),
                relationships: Vec::new(),
            }),
            None => Ok(ScoreApiExplainOutput::NotFound { symbol: input.symbol }),
        }
    }

    async fn status(&self, _input: ScoreApiStatusInput, storage: &dyn ConceptStorage) -> Result<ScoreApiStatusOutput, Box<dyn std::error::Error>> {
        let concepts = storage.find("score-concept", None).await?;
        let symbols = storage.find("symbol", None).await?;
        let files = storage.find("files", None).await?;
        let syncs = storage.find("score-sync", None).await?;
        Ok(ScoreApiStatusOutput::Ok {
            indexed: !concepts.is_empty() || !symbols.is_empty(),
            concept_count: concepts.len() as i64,
            symbol_count: symbols.len() as i64,
            file_count: files.len() as i64,
            sync_count: syncs.len() as i64,
            last_indexed: chrono::Utc::now(),
        })
    }

    async fn reindex(&self, _input: ScoreApiReindexInput, storage: &dyn ConceptStorage) -> Result<ScoreApiReindexOutput, Box<dyn std::error::Error>> {
        let concepts = storage.find("score-concept", None).await?.len() as i64;
        let symbols = storage.find("symbol", None).await?.len() as i64;
        let files = storage.find("files", None).await?.len() as i64;
        let syncs = storage.find("score-sync", None).await?.len() as i64;
        Ok(ScoreApiReindexOutput::Ok { concept_count: concepts, symbol_count: symbols, file_count: files, sync_count: syncs, duration: 0 })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_list_files_empty() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.list_files(
            ScoreApiListFilesInput { pattern: "**/*.ts".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiListFilesOutput::Empty { .. } => {},
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_get_file_content_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.get_file_content(
            ScoreApiGetFileContentInput { path: "missing.ts".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiGetFileContentOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_symbol_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.find_symbol(
            ScoreApiFindSymbolInput { name: "missing".to_string(), kind: None },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiFindSymbolOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_concept_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.get_concept(
            ScoreApiGetConceptInput { name: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiGetConceptOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_action_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.get_action(
            ScoreApiGetActionInput { concept: "user".to_string(), action: "create".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiGetActionOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_search_empty() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.search(
            ScoreApiSearchInput { query: "nonexistent".to_string(), limit: 10 },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiSearchOutput::Empty { .. } => {},
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_explain_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.explain(
            ScoreApiExplainInput { symbol: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiExplainOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_status_empty_index() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.status(
            ScoreApiStatusInput {},
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiStatusOutput::Ok { indexed, concept_count, .. } => {
                assert!(!indexed);
                assert_eq!(concept_count, 0);
            },
        }
    }

    #[tokio::test]
    async fn test_get_data_flow_no_path() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.get_data_flow(
            ScoreApiGetDataFlowInput { from: "a".to_string(), to: "b".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiGetDataFlowOutput::NoPath { .. } => {},
            _ => panic!("Expected NoPath variant"),
        }
    }

    #[tokio::test]
    async fn test_reindex_empty() {
        let storage = InMemoryStorage::new();
        let handler = ScoreApiHandlerImpl;
        let result = handler.reindex(
            ScoreApiReindexInput {},
            &storage,
        ).await.unwrap();
        match result {
            ScoreApiReindexOutput::Ok { concept_count, symbol_count, .. } => {
                assert_eq!(concept_count, 0);
                assert_eq!(symbol_count, 0);
            },
        }
    }
}
