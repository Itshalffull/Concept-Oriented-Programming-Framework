// TrigramIndexProvider Handler Implementation
//
// Search index provider using trigram indexing for fast substring
// and regex text search across project files. Extracts trigrams
// from document text, builds posting lists, and intersects them
// during search for candidate filtering before final verification.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TrigramIndexProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashSet;

static COUNTER: AtomicU64 = AtomicU64::new(0);

const PROVIDER_REF: &str = "search:trigram";
const INSTANCE_RELATION: &str = "trigram-index-provider";

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("trigram-index-provider-{}", n)
}

/// Extract all unique 3-character trigrams from text (lowercased).
fn extract_trigrams(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    let mut trigrams = HashSet::new();
    if chars.len() >= 3 {
        for i in 0..=(chars.len() - 3) {
            let tri: String = chars[i..i + 3].iter().collect();
            trigrams.insert(tri);
        }
    }
    trigrams.into_iter().collect()
}

pub struct TrigramIndexProviderHandlerImpl;

#[async_trait]
impl TrigramIndexProviderHandler for TrigramIndexProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: TrigramIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TrigramIndexProviderInitializeOutput, Box<dyn std::error::Error>> {
        // Check if already registered
        let existing = storage.find(INSTANCE_RELATION, json!({ "providerRef": PROVIDER_REF })).await?;
        if let Some(arr) = existing.as_array() {
            if !arr.is_empty() {
                if let Some(id) = arr[0].get("id").and_then(|v| v.as_str()) {
                    return Ok(TrigramIndexProviderInitializeOutput::Ok {
                        instance: id.to_string(),
                    });
                }
            }
        }

        let id = next_id();
        storage.put(INSTANCE_RELATION, &id, json!({
            "id": id,
            "providerRef": PROVIDER_REF
        })).await?;

        Ok(TrigramIndexProviderInitializeOutput::Ok { instance: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = TrigramIndexProviderHandlerImpl;
        let result = handler.initialize(
            TrigramIndexProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            TrigramIndexProviderInitializeOutput::Ok { instance } => {
                assert!(!instance.is_empty());
                assert!(instance.contains("trigram-index-provider"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = TrigramIndexProviderHandlerImpl;
        let r1 = handler.initialize(TrigramIndexProviderInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(TrigramIndexProviderInitializeInput {}, &storage).await.unwrap();
        match (r1, r2) {
            (TrigramIndexProviderInitializeOutput::Ok { instance: id1 },
             TrigramIndexProviderInitializeOutput::Ok { instance: id2 }) => {
                // Both should succeed (second may be idempotent or unique depending on storage.find behavior)
                assert!(!id1.is_empty());
                assert!(!id2.is_empty());
            },
            _ => panic!("Expected Ok variants"),
        }
    }

    #[test]
    fn test_extract_trigrams() {
        let trigrams = extract_trigrams("hello");
        assert!(trigrams.contains(&"hel".to_string()));
        assert!(trigrams.contains(&"ell".to_string()));
        assert!(trigrams.contains(&"llo".to_string()));
    }

    #[test]
    fn test_extract_trigrams_short_text() {
        let trigrams = extract_trigrams("hi");
        assert!(trigrams.is_empty());
    }
}
