// ScoreIndex concept implementation
// Materialized index backing ScoreApi queries. Maintains denormalized views
// of the five Score layers (concepts, syncs, symbols, files) optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in concept.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ScoreIndexHandler;
use serde_json::json;

pub struct ScoreIndexHandlerImpl;

#[async_trait]
impl ScoreIndexHandler for ScoreIndexHandlerImpl {
    async fn upsert_concept(
        &self,
        input: ScoreIndexUpsertConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertConceptOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(ScoreIndexUpsertConceptOutput::Error {
                message: "name is required".to_string(),
            });
        }

        let id = format!("concept:{}", input.name);
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("concepts", &id, json!({
            "conceptName": input.name,
            "purpose": input.purpose,
            "actions": input.actions,
            "stateFields": input.state_fields,
            "file": input.file,
        })).await?;

        storage.put("meta", "concepts", json!({
            "kind": "concepts",
            "lastUpdated": now,
        })).await?;

        Ok(ScoreIndexUpsertConceptOutput::Ok { index: id })
    }

    async fn upsert_sync(
        &self,
        input: ScoreIndexUpsertSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertSyncOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(ScoreIndexUpsertSyncOutput::Error {
                message: "name is required".to_string(),
            });
        }

        let id = format!("sync:{}", input.name);
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("syncs", &id, json!({
            "syncName": input.name,
            "annotation": if input.annotation.is_empty() { "eager".to_string() } else { input.annotation },
            "triggers": input.triggers,
            "effects": input.effects,
            "file": input.file,
        })).await?;

        storage.put("meta", "syncs", json!({
            "kind": "syncs",
            "lastUpdated": now,
        })).await?;

        Ok(ScoreIndexUpsertSyncOutput::Ok { index: id })
    }

    async fn upsert_symbol(
        &self,
        input: ScoreIndexUpsertSymbolInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertSymbolOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(ScoreIndexUpsertSymbolOutput::Error {
                message: "name is required".to_string(),
            });
        }

        let id = format!("symbol:{}:{}:{}", input.name, input.file, input.line);
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("symbols", &id, json!({
            "symbolName": input.name,
            "symbolKind": if input.kind.is_empty() { "unknown".to_string() } else { input.kind },
            "file": input.file,
            "line": input.line,
            "scope": input.scope,
        })).await?;

        storage.put("meta", "symbols", json!({
            "kind": "symbols",
            "lastUpdated": now,
        })).await?;

        Ok(ScoreIndexUpsertSymbolOutput::Ok { index: id })
    }

    async fn upsert_file(
        &self,
        input: ScoreIndexUpsertFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertFileOutput, Box<dyn std::error::Error>> {
        if input.path.is_empty() {
            return Ok(ScoreIndexUpsertFileOutput::Error {
                message: "path is required".to_string(),
            });
        }

        let id = format!("file:{}", input.path);
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("files", &id, json!({
            "filePath": input.path,
            "language": if input.language.is_empty() { "unknown".to_string() } else { input.language },
            "role": if input.role.is_empty() { "source".to_string() } else { input.role },
            "definitions": input.definitions,
        })).await?;

        storage.put("meta", "files", json!({
            "kind": "files",
            "lastUpdated": now,
        })).await?;

        Ok(ScoreIndexUpsertFileOutput::Ok { index: id })
    }

    async fn remove_by_file(
        &self,
        input: ScoreIndexRemoveByFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexRemoveByFileOutput, Box<dyn std::error::Error>> {
        if input.path.is_empty() {
            return Ok(ScoreIndexRemoveByFileOutput::Ok { removed: 0 });
        }

        let mut removed: i64 = 0;

        // Remove the file entry itself
        let file_id = format!("file:{}", input.path);
        let existing = storage.get("files", &file_id).await?;
        if existing.is_some() {
            storage.del("files", &file_id).await?;
            removed += 1;
        }

        // Remove symbols from this file
        let symbols = storage.find("symbols", Some(&json!({"file": input.path}))).await?;
        for sym in &symbols {
            let sym_name = sym.get("symbolName").and_then(|v| v.as_str()).unwrap_or("");
            let sym_file = sym.get("file").and_then(|v| v.as_str()).unwrap_or("");
            let sym_line = sym.get("line").and_then(|v| v.as_i64()).unwrap_or(0);
            let sym_id = format!("symbol:{}:{}:{}", sym_name, sym_file, sym_line);
            storage.del("symbols", &sym_id).await?;
            removed += 1;
        }

        // Remove concepts from this file
        let concepts = storage.find("concepts", Some(&json!({"file": input.path}))).await?;
        for c in &concepts {
            let c_name = c.get("conceptName").and_then(|v| v.as_str()).unwrap_or("");
            let c_id = format!("concept:{}", c_name);
            storage.del("concepts", &c_id).await?;
            removed += 1;
        }

        // Remove syncs from this file
        let syncs = storage.find("syncs", Some(&json!({"file": input.path}))).await?;
        for s in &syncs {
            let s_name = s.get("syncName").and_then(|v| v.as_str()).unwrap_or("");
            let s_id = format!("sync:{}", s_name);
            storage.del("syncs", &s_id).await?;
            removed += 1;
        }

        Ok(ScoreIndexRemoveByFileOutput::Ok { removed })
    }

    async fn clear(
        &self,
        _input: ScoreIndexClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexClearOutput, Box<dyn std::error::Error>> {
        let concepts = storage.find("concepts", None).await?;
        let syncs = storage.find("syncs", None).await?;
        let symbols = storage.find("symbols", None).await?;
        let files = storage.find("files", None).await?;

        let total = (concepts.len() + syncs.len() + symbols.len() + files.len()) as i64;

        for c in &concepts {
            let name = c.get("conceptName").and_then(|v| v.as_str()).unwrap_or("");
            storage.del("concepts", &format!("concept:{}", name)).await?;
        }
        for s in &syncs {
            let name = s.get("syncName").and_then(|v| v.as_str()).unwrap_or("");
            storage.del("syncs", &format!("sync:{}", name)).await?;
        }
        for sym in &symbols {
            let name = sym.get("symbolName").and_then(|v| v.as_str()).unwrap_or("");
            let file = sym.get("file").and_then(|v| v.as_str()).unwrap_or("");
            let line = sym.get("line").and_then(|v| v.as_i64()).unwrap_or(0);
            storage.del("symbols", &format!("symbol:{}:{}:{}", name, file, line)).await?;
        }
        for f in &files {
            let path = f.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
            storage.del("files", &format!("file:{}", path)).await?;
        }

        Ok(ScoreIndexClearOutput::Ok { cleared: total })
    }

    async fn stats(
        &self,
        _input: ScoreIndexStatsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexStatsOutput, Box<dyn std::error::Error>> {
        let concepts = storage.find("concepts", None).await?;
        let syncs = storage.find("syncs", None).await?;
        let symbols = storage.find("symbols", None).await?;
        let files = storage.find("files", None).await?;

        let meta = storage.get("meta", "concepts").await?;
        let last_updated_str = meta
            .and_then(|m| m.get("lastUpdated").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

        let last_updated = last_updated_str
            .parse::<chrono::DateTime<chrono::Utc>>()
            .unwrap_or_else(|_| chrono::Utc::now());

        Ok(ScoreIndexStatsOutput::Ok {
            concept_count: concepts.len() as i64,
            sync_count: syncs.len() as i64,
            symbol_count: symbols.len() as i64,
            file_count: files.len() as i64,
            last_updated,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_upsert_concept_success() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.upsert_concept(
            ScoreIndexUpsertConceptInput {
                name: "user".to_string(),
                purpose: "manage users".to_string(),
                actions: vec!["create".to_string()],
                state_fields: vec![],
                file: "user.concept".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexUpsertConceptOutput::Ok { index } => {
                assert_eq!(index, "concept:user");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_upsert_concept_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.upsert_concept(
            ScoreIndexUpsertConceptInput {
                name: "".to_string(), purpose: "".to_string(),
                actions: vec![], state_fields: vec![], file: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexUpsertConceptOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_upsert_symbol_success() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.upsert_symbol(
            ScoreIndexUpsertSymbolInput {
                name: "createUser".to_string(), kind: "function".to_string(),
                file: "user.ts".to_string(), line: 10, scope: "module".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexUpsertSymbolOutput::Ok { index } => {
                assert!(index.contains("createUser"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_upsert_file_empty_path() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.upsert_file(
            ScoreIndexUpsertFileInput {
                path: "".to_string(), language: "".to_string(),
                role: "".to_string(), definitions: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexUpsertFileOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_clear_empty() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.clear(
            ScoreIndexClearInput {},
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexClearOutput::Ok { cleared } => {
                assert_eq!(cleared, 0);
            },
        }
    }

    #[tokio::test]
    async fn test_stats_empty() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.stats(
            ScoreIndexStatsInput {},
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexStatsOutput::Ok { concept_count, symbol_count, file_count, sync_count, .. } => {
                assert_eq!(concept_count, 0);
                assert_eq!(symbol_count, 0);
                assert_eq!(file_count, 0);
                assert_eq!(sync_count, 0);
            },
        }
    }

    #[tokio::test]
    async fn test_remove_by_file_empty_path() {
        let storage = InMemoryStorage::new();
        let handler = ScoreIndexHandlerImpl;
        let result = handler.remove_by_file(
            ScoreIndexRemoveByFileInput { path: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ScoreIndexRemoveByFileOutput::Ok { removed } => {
                assert_eq!(removed, 0);
            },
        }
    }
}
