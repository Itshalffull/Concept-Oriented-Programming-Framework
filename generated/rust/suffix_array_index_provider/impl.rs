// Suffix array index provider: initializes a suffix-array based search index
// for fast substring matching across symbol names and code content.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SuffixArrayIndexProviderHandler;
use serde_json::json;

pub struct SuffixArrayIndexProviderHandlerImpl;

static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    format!("suffix-array-index-{}", n)
}

#[async_trait]
impl SuffixArrayIndexProviderHandler for SuffixArrayIndexProviderHandlerImpl {
    async fn initialize(
        &self,
        _input: SuffixArrayIndexProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SuffixArrayIndexProviderInitializeOutput, Box<dyn std::error::Error>> {
        let id = next_id();

        // Initialize the suffix array index with empty corpus
        // The suffix array stores sorted suffixes for O(log n) substring search.
        // On initialization we create the index metadata; actual corpus is built
        // incrementally as documents are added.
        storage.put("suffix-array-index", &id, json!({
            "id": &id,
            "providerRef": &id,
            "indexType": "suffix-array",
            "corpusSize": 0,
            "suffixCount": 0,
        })).await?;

        Ok(SuffixArrayIndexProviderInitializeOutput::Ok {
            instance: id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize() {
        let storage = InMemoryStorage::new();
        let handler = SuffixArrayIndexProviderHandlerImpl;
        let result = handler.initialize(
            SuffixArrayIndexProviderInitializeInput {},
            &storage,
        ).await.unwrap();
        match result {
            SuffixArrayIndexProviderInitializeOutput::Ok { instance } => {
                assert!(instance.starts_with("suffix-array-index-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_unique_ids() {
        let storage = InMemoryStorage::new();
        let handler = SuffixArrayIndexProviderHandlerImpl;
        let r1 = handler.initialize(SuffixArrayIndexProviderInitializeInput {}, &storage).await.unwrap();
        let r2 = handler.initialize(SuffixArrayIndexProviderInitializeInput {}, &storage).await.unwrap();
        let id1 = match r1 { SuffixArrayIndexProviderInitializeOutput::Ok { instance } => instance, _ => panic!("Expected Ok") };
        let id2 = match r2 { SuffixArrayIndexProviderInitializeOutput::Ok { instance } => instance, _ => panic!("Expected Ok") };
        assert_ne!(id1, id2);
    }
}
