// BuildCache concept implementation
// Tracks input/output hashes for generation steps. Enables incremental rebuilds
// by skipping generation when inputs haven't changed since the last successful run.
// See clef-generation-suite.md Part 1.3

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BuildCacheHandler;
use serde_json::json;
use chrono::{DateTime, Utc};

const ENTRIES_RELATION: &str = "entries";

pub struct BuildCacheHandlerImpl;

#[async_trait]
impl BuildCacheHandler for BuildCacheHandlerImpl {
    async fn check(
        &self,
        input: BuildCacheCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheCheckOutput, Box<dyn std::error::Error>> {
        let existing = storage.get(ENTRIES_RELATION, &input.step_key).await?;

        let existing = match existing {
            Some(e) => e,
            None => return Ok(BuildCacheCheckOutput::Changed { previous_hash: None }),
        };

        let stored_input_hash = existing["inputHash"].as_str().unwrap_or("").to_string();
        let stale = existing["stale"].as_bool().unwrap_or(false);

        // Nondeterministic transforms always re-run
        if !input.deterministic {
            return Ok(BuildCacheCheckOutput::Changed {
                previous_hash: Some(stored_input_hash),
            });
        }

        // Stale entries always re-run
        if stale {
            return Ok(BuildCacheCheckOutput::Changed {
                previous_hash: Some(stored_input_hash),
            });
        }

        // Hash mismatch means input changed
        if stored_input_hash != input.input_hash {
            return Ok(BuildCacheCheckOutput::Changed {
                previous_hash: Some(stored_input_hash),
            });
        }

        // Cache hit -- input unchanged and deterministic
        let last_run_str = existing["lastRun"].as_str().unwrap_or("");
        let last_run: DateTime<Utc> = last_run_str.parse().unwrap_or_else(|_| Utc::now());
        let output_ref = existing["outputRef"].as_str().map(|s| s.to_string());

        Ok(BuildCacheCheckOutput::Unchanged {
            last_run,
            output_ref,
        })
    }

    async fn record(
        &self,
        input: BuildCacheRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheRecordOutput, Box<dyn std::error::Error>> {
        let existing = storage.get(ENTRIES_RELATION, &input.step_key).await?;
        let entry_id = match &existing {
            Some(e) => e["id"].as_str().unwrap_or("").to_string(),
            None => uuid::Uuid::new_v4().to_string(),
        };
        let now = Utc::now().to_rfc3339();

        storage.put(ENTRIES_RELATION, &input.step_key, json!({
            "id": entry_id,
            "stepKey": input.step_key,
            "inputHash": input.input_hash,
            "outputHash": input.output_hash,
            "outputRef": input.output_ref,
            "sourceLocator": input.source_locator,
            "kind": null,
            "deterministic": input.deterministic,
            "lastRun": now,
            "stale": false,
        })).await?;

        Ok(BuildCacheRecordOutput::Ok { entry: entry_id })
    }

    async fn invalidate(
        &self,
        input: BuildCacheInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get(ENTRIES_RELATION, &input.step_key).await?;
        match existing {
            Some(mut e) => {
                e["stale"] = json!(true);
                storage.put(ENTRIES_RELATION, &input.step_key, e).await?;
                Ok(BuildCacheInvalidateOutput::Ok)
            }
            None => Ok(BuildCacheInvalidateOutput::NotFound),
        }
    }

    async fn invalidate_by_source(
        &self,
        input: BuildCacheInvalidateBySourceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateBySourceOutput, Box<dyn std::error::Error>> {
        let all_entries = storage.find(ENTRIES_RELATION, None).await?;
        let mut invalidated = Vec::new();

        for entry in &all_entries {
            if entry["sourceLocator"].as_str() == Some(&input.source_locator) {
                let step_key = entry["stepKey"].as_str().unwrap_or("").to_string();
                let mut updated = entry.clone();
                updated["stale"] = json!(true);
                storage.put(ENTRIES_RELATION, &step_key, updated).await?;
                invalidated.push(step_key);
            }
        }

        Ok(BuildCacheInvalidateBySourceOutput::Ok { invalidated })
    }

    async fn invalidate_by_kind(
        &self,
        input: BuildCacheInvalidateByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateByKindOutput, Box<dyn std::error::Error>> {
        let all_entries = storage.find(ENTRIES_RELATION, None).await?;
        let mut invalidated = Vec::new();

        for entry in &all_entries {
            let step_key = entry["stepKey"].as_str().unwrap_or("").to_string();
            let entry_kind = entry["kind"].as_str();

            let matches = match entry_kind {
                Some(k) => k == input.kind_name,
                None => step_key.contains(&input.kind_name),
            };

            if matches {
                let mut updated = entry.clone();
                updated["stale"] = json!(true);
                storage.put(ENTRIES_RELATION, &step_key, updated).await?;
                invalidated.push(step_key);
            }
        }

        Ok(BuildCacheInvalidateByKindOutput::Ok { invalidated })
    }

    async fn invalidate_all(
        &self,
        _input: BuildCacheInvalidateAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheInvalidateAllOutput, Box<dyn std::error::Error>> {
        let all_entries = storage.find(ENTRIES_RELATION, None).await?;
        let mut cleared: i64 = 0;

        for entry in &all_entries {
            let step_key = entry["stepKey"].as_str().unwrap_or("").to_string();
            let mut updated = entry.clone();
            updated["stale"] = json!(true);
            storage.put(ENTRIES_RELATION, &step_key, updated).await?;
            cleared += 1;
        }

        Ok(BuildCacheInvalidateAllOutput::Ok { cleared })
    }

    async fn status(
        &self,
        _input: BuildCacheStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheStatusOutput, Box<dyn std::error::Error>> {
        let all_entries = storage.find(ENTRIES_RELATION, None).await?;
        let entries = all_entries.iter().map(|entry| {
            let last_run_str = entry["lastRun"].as_str().unwrap_or("");
            let last_run: DateTime<Utc> = last_run_str.parse().unwrap_or_else(|_| Utc::now());
            BuildCacheStatusEntry {
                step_key: entry["stepKey"].as_str().unwrap_or("").to_string(),
                input_hash: entry["inputHash"].as_str().unwrap_or("").to_string(),
                last_run,
                stale: entry["stale"].as_bool().unwrap_or(false),
            }
        }).collect();

        Ok(BuildCacheStatusOutput::Ok { entries })
    }

    async fn stale_steps(
        &self,
        _input: BuildCacheStaleStepsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuildCacheStaleStepsOutput, Box<dyn std::error::Error>> {
        let all_entries = storage.find(ENTRIES_RELATION, None).await?;
        let steps: Vec<String> = all_entries.iter()
            .filter(|entry| entry["stale"].as_bool() == Some(true))
            .map(|entry| entry["stepKey"].as_str().unwrap_or("").to_string())
            .collect();

        Ok(BuildCacheStaleStepsOutput::Ok { steps })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_check_no_entry_returns_changed() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        let result = handler.check(
            BuildCacheCheckInput {
                step_key: "gen:article".to_string(),
                input_hash: "abc123".to_string(),
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheCheckOutput::Changed { previous_hash } => {
                assert!(previous_hash.is_none());
            }
            _ => panic!("Expected Changed variant"),
        }
    }

    #[tokio::test]
    async fn test_record_and_check_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        handler.record(
            BuildCacheRecordInput {
                step_key: "gen:user".to_string(),
                input_hash: "hash-1".to_string(),
                output_hash: "out-1".to_string(),
                output_ref: Some("ref-1".to_string()),
                source_locator: Some("src/user.concept".to_string()),
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        let result = handler.check(
            BuildCacheCheckInput {
                step_key: "gen:user".to_string(),
                input_hash: "hash-1".to_string(),
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheCheckOutput::Unchanged { output_ref, .. } => {
                assert_eq!(output_ref, Some("ref-1".to_string()));
            }
            _ => panic!("Expected Unchanged variant"),
        }
    }

    #[tokio::test]
    async fn test_check_hash_mismatch_returns_changed() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        handler.record(
            BuildCacheRecordInput {
                step_key: "gen:echo".to_string(),
                input_hash: "old-hash".to_string(),
                output_hash: "out-1".to_string(),
                output_ref: None,
                source_locator: None,
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        let result = handler.check(
            BuildCacheCheckInput {
                step_key: "gen:echo".to_string(),
                input_hash: "new-hash".to_string(),
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheCheckOutput::Changed { previous_hash } => {
                assert_eq!(previous_hash, Some("old-hash".to_string()));
            }
            _ => panic!("Expected Changed variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_existing_entry() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        handler.record(
            BuildCacheRecordInput {
                step_key: "gen:profile".to_string(),
                input_hash: "h1".to_string(),
                output_hash: "o1".to_string(),
                output_ref: None,
                source_locator: None,
                deterministic: true,
            },
            &storage,
        ).await.unwrap();
        let result = handler.invalidate(
            BuildCacheInvalidateInput { step_key: "gen:profile".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheInvalidateOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        let result = handler.invalidate(
            BuildCacheInvalidateInput { step_key: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheInvalidateOutput::NotFound => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_all() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        let result = handler.invalidate_all(
            BuildCacheInvalidateAllInput {},
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheInvalidateAllOutput::Ok { cleared } => {
                assert_eq!(cleared, 0);
            }
        }
    }

    #[tokio::test]
    async fn test_stale_steps_returns_empty() {
        let storage = InMemoryStorage::new();
        let handler = BuildCacheHandlerImpl;
        let result = handler.stale_steps(
            BuildCacheStaleStepsInput {},
            &storage,
        ).await.unwrap();
        match result {
            BuildCacheStaleStepsOutput::Ok { steps } => {
                assert!(steps.is_empty());
            }
        }
    }
}
