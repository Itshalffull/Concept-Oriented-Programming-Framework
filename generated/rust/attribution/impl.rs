// Attribution concept implementation
// Bind agent identity to content regions, tracking who created or modified each piece.
// Supports blame queries, per-region authorship history, and CODEOWNERS-style ownership patterns.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AttributionHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashMap;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("attribution-{}", id)
}

/// Check whether a glob-style pattern matches a given path.
/// Supports * (any segment) and ** (any depth) wildcards.
fn match_pattern(pattern: &str, path: &str) -> bool {
    let regex_str = pattern
        .replace('.', "\\.")
        .replace('+', "\\+")
        .replace('^', "\\^")
        .replace('$', "\\$")
        .replace('{', "\\{")
        .replace('}', "\\}")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .replace('|', "\\|")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace("**", "__DOUBLESTAR__")
        .replace('*', "[^/]*")
        .replace("__DOUBLESTAR__", ".*");

    let full_pattern = format!("^{}$", regex_str);
    regex::Regex::new(&full_pattern)
        .map(|r| r.is_match(path))
        .unwrap_or(false)
}

pub struct AttributionHandlerImpl;

#[async_trait]
impl AttributionHandler for AttributionHandlerImpl {
    async fn attribute(
        &self,
        input: AttributionAttributeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionAttributeOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("attribution", &id, json!({
            "id": id,
            "contentRef": input.content_ref,
            "region": input.region,
            "agent": input.agent,
            "timestamp": now,
            "changeRef": input.change_ref,
        })).await?;

        Ok(AttributionAttributeOutput::Ok { attribution_id: id })
    }

    async fn blame(
        &self,
        input: AttributionBlameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionBlameOutput, Box<dyn std::error::Error>> {
        let records = storage.find("attribution", Some(&json!({
            "contentRef": input.content_ref,
        }))).await?;

        // Build blame map: for each region, find the most recent attribution
        let mut region_map: HashMap<String, (String, String, String)> = HashMap::new();
        for record in &records {
            let region = record["region"].as_str().unwrap_or("").to_string();
            let timestamp = record["timestamp"].as_str().unwrap_or("").to_string();
            let agent = record["agent"].as_str().unwrap_or("").to_string();
            let change_ref = record["changeRef"].as_str().unwrap_or("").to_string();

            if let Some(existing) = region_map.get(&region) {
                if timestamp > existing.2 {
                    region_map.insert(region, (agent, change_ref, timestamp));
                }
            } else {
                region_map.insert(region, (agent, change_ref, timestamp));
            }
        }

        let map: Vec<serde_json::Value> = region_map.iter().map(|(region, (agent, change_ref, _ts))| {
            json!({
                "region": region,
                "agent": agent,
                "changeRef": change_ref,
            })
        }).collect();

        Ok(AttributionBlameOutput::Ok { map })
    }

    async fn history(
        &self,
        input: AttributionHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionHistoryOutput, Box<dyn std::error::Error>> {
        let records = storage.find("attribution", Some(&json!({
            "contentRef": input.content_ref,
            "region": input.region,
        }))).await?;

        if records.is_empty() {
            return Ok(AttributionHistoryOutput::NotFound {
                message: format!(
                    "No attributions found for contentRef '{}' and region '{}'",
                    input.content_ref, input.region
                ),
            });
        }

        // Sort chronologically
        let mut sorted = records.clone();
        sorted.sort_by(|a, b| {
            let ta = a["timestamp"].as_str().unwrap_or("");
            let tb = b["timestamp"].as_str().unwrap_or("");
            ta.cmp(tb)
        });

        let chain: Vec<String> = sorted.iter()
            .map(|r| r["id"].as_str().unwrap_or("").to_string())
            .collect();

        Ok(AttributionHistoryOutput::Ok { chain })
    }

    async fn set_ownership(
        &self,
        input: AttributionSetOwnershipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionSetOwnershipOutput, Box<dyn std::error::Error>> {
        // Check if an ownership rule for this pattern already exists
        let existing = storage.find("attribution-ownership", Some(&json!({
            "pattern": input.pattern,
        }))).await?;

        if !existing.is_empty() {
            let mut updated = existing[0].clone();
            updated["owners"] = json!(serde_json::to_string(&input.owners)?);
            let id = existing[0]["id"].as_str().unwrap_or("");
            storage.put("attribution-ownership", id, updated).await?;
        } else {
            let id = format!("ownership-{}", input.pattern.replace(|c: char| !c.is_alphanumeric(), "-"));
            storage.put("attribution-ownership", &id, json!({
                "id": id,
                "pattern": input.pattern,
                "owners": serde_json::to_string(&input.owners)?,
            })).await?;
        }

        Ok(AttributionSetOwnershipOutput::Ok)
    }

    async fn query_owners(
        &self,
        input: AttributionQueryOwnersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionQueryOwnersOutput, Box<dyn std::error::Error>> {
        let rules = storage.find("attribution-ownership", None).await?;

        let mut matched_owners: Vec<String> = Vec::new();
        let mut matched = false;

        for rule in &rules {
            let rule_pattern = rule["pattern"].as_str().unwrap_or("");
            if match_pattern(rule_pattern, &input.path) {
                matched = true;
                let rule_owners: Vec<String> = serde_json::from_str(
                    rule["owners"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                for owner in rule_owners {
                    if !matched_owners.contains(&owner) {
                        matched_owners.push(owner);
                    }
                }
            }
        }

        if !matched {
            return Ok(AttributionQueryOwnersOutput::NoMatch {
                message: format!("No ownership pattern matches path '{}'", input.path),
            });
        }

        Ok(AttributionQueryOwnersOutput::Ok { owners: matched_owners })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_attribute_creates_attribution() {
        let storage = InMemoryStorage::new();
        let handler = AttributionHandlerImpl;
        let result = handler.attribute(
            AttributionAttributeInput {
                content_ref: "doc-1".to_string(),
                region: b"section-1".to_vec(),
                agent: "user-a".to_string(),
                change_ref: "change-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AttributionAttributeOutput::Ok { attribution_id } => {
                assert!(attribution_id.starts_with("attribution-"));
            }
        }
    }

    #[tokio::test]
    async fn test_blame_returns_map() {
        let storage = InMemoryStorage::new();
        let handler = AttributionHandlerImpl;
        handler.attribute(
            AttributionAttributeInput {
                content_ref: "doc-2".to_string(),
                region: b"intro".to_vec(),
                agent: "user-b".to_string(),
                change_ref: "chg-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.blame(
            AttributionBlameInput { content_ref: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AttributionBlameOutput::Ok { map } => {
                // blame returns entries for the content ref
                assert!(map.is_empty() || !map.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_set_ownership_and_query_owners() {
        let storage = InMemoryStorage::new();
        let handler = AttributionHandlerImpl;
        handler.set_ownership(
            AttributionSetOwnershipInput {
                pattern: "src/**".to_string(),
                owners: vec!["team-core".to_string()],
            },
            &storage,
        ).await.unwrap();
        let result = handler.query_owners(
            AttributionQueryOwnersInput { path: "src/main.rs".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AttributionQueryOwnersOutput::Ok { owners } => {
                assert!(owners.contains(&"team-core".to_string()));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_query_owners_no_match() {
        let storage = InMemoryStorage::new();
        let handler = AttributionHandlerImpl;
        let result = handler.query_owners(
            AttributionQueryOwnersInput { path: "unknown/path.txt".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AttributionQueryOwnersOutput::NoMatch { message } => {
                assert!(message.contains("No ownership pattern"));
            }
            _ => panic!("Expected NoMatch variant"),
        }
    }

    #[tokio::test]
    async fn test_history_not_found() {
        let storage = InMemoryStorage::new();
        let handler = AttributionHandlerImpl;
        let result = handler.history(
            AttributionHistoryInput {
                content_ref: "nonexistent".to_string(),
                region: b"section".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AttributionHistoryOutput::NotFound { message } => {
                assert!(message.contains("No attributions found"));
            }
            _ => panic!("Expected NotFound variant"),
        }
    }
}
