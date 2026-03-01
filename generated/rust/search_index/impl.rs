// SearchIndex concept implementation
// Full-text search index with create, index, remove, search, processor pipeline,
// and reindex operations. Each index maintains its own configuration and processors.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SearchIndexHandler;
use serde_json::json;

pub struct SearchIndexHandlerImpl;

#[async_trait]
impl SearchIndexHandler for SearchIndexHandlerImpl {
    async fn create_index(
        &self,
        input: SearchIndexCreateIndexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexCreateIndexOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("search-index", &input.index).await?;
        if existing.is_some() {
            return Ok(SearchIndexCreateIndexOutput::Exists {
                index: input.index,
            });
        }

        storage.put("search-index", &input.index, json!({
            "index": input.index,
            "config": input.config,
            "processors": [],
            "itemCount": 0,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(SearchIndexCreateIndexOutput::Ok {
            index: input.index,
        })
    }

    async fn index_item(
        &self,
        input: SearchIndexIndexItemInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexIndexItemOutput, Box<dyn std::error::Error>> {
        let index_record = storage.get("search-index", &input.index).await?;
        if index_record.is_none() {
            return Ok(SearchIndexIndexItemOutput::Notfound {
                index: input.index,
            });
        }

        let item_key = format!("{}:{}", input.index, input.item);

        // Tokenize the data for search (simple whitespace tokenization + lowercase)
        let tokens: Vec<String> = input.data
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        storage.put("search-item", &item_key, json!({
            "index": input.index,
            "item": input.item,
            "data": input.data,
            "tokens": tokens,
            "indexedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        // Update item count
        if let Some(mut idx) = storage.get("search-index", &input.index).await? {
            let count = idx.get("itemCount").and_then(|v| v.as_i64()).unwrap_or(0);
            idx["itemCount"] = json!(count + 1);
            storage.put("search-index", &input.index, idx).await?;
        }

        Ok(SearchIndexIndexItemOutput::Ok {
            index: input.index,
        })
    }

    async fn remove_item(
        &self,
        input: SearchIndexRemoveItemInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexRemoveItemOutput, Box<dyn std::error::Error>> {
        let index_record = storage.get("search-index", &input.index).await?;
        if index_record.is_none() {
            return Ok(SearchIndexRemoveItemOutput::Notfound {
                index: input.index,
            });
        }

        let item_key = format!("{}:{}", input.index, input.item);
        let existing_item = storage.get("search-item", &item_key).await?;
        if existing_item.is_none() {
            return Ok(SearchIndexRemoveItemOutput::Notfound {
                index: input.index,
            });
        }

        storage.del("search-item", &item_key).await?;

        // Decrement item count
        if let Some(mut idx) = storage.get("search-index", &input.index).await? {
            let count = idx.get("itemCount").and_then(|v| v.as_i64()).unwrap_or(1);
            idx["itemCount"] = json!((count - 1).max(0));
            storage.put("search-index", &input.index, idx).await?;
        }

        Ok(SearchIndexRemoveItemOutput::Ok {
            index: input.index,
        })
    }

    async fn search(
        &self,
        input: SearchIndexSearchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexSearchOutput, Box<dyn std::error::Error>> {
        let index_record = storage.get("search-index", &input.index).await?;
        if index_record.is_none() {
            return Ok(SearchIndexSearchOutput::Notfound {
                index: input.index,
            });
        }

        // Find all items in this index
        let items = storage.find("search-item", Some(&json!({"index": input.index}))).await?;

        // Tokenize query
        let query_tokens: Vec<String> = input.query
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        // Score each item by token match count
        let mut scored: Vec<(f64, &serde_json::Value)> = items.iter()
            .filter_map(|item| {
                let tokens = item.get("tokens")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect::<Vec<_>>())
                    .unwrap_or_default();

                let mut score = 0.0;
                for qt in &query_tokens {
                    for token in &tokens {
                        if token.contains(qt.as_str()) {
                            score += 1.0;
                        }
                    }
                }

                if score > 0.0 {
                    Some((score, item))
                } else {
                    None
                }
            })
            .collect();

        // Sort by score descending
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<serde_json::Value> = scored.iter().map(|(score, item)| {
            json!({
                "item": item.get("item"),
                "data": item.get("data"),
                "score": score,
            })
        }).collect();

        Ok(SearchIndexSearchOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn add_processor(
        &self,
        input: SearchIndexAddProcessorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexAddProcessorOutput, Box<dyn std::error::Error>> {
        let index_record = storage.get("search-index", &input.index).await?;
        let mut index_record = match index_record {
            Some(r) => r,
            None => return Ok(SearchIndexAddProcessorOutput::Notfound {
                index: input.index,
            }),
        };

        let mut processors = index_record.get("processors")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        processors.push(json!(input.processor));
        index_record["processors"] = json!(processors);

        storage.put("search-index", &input.index, index_record).await?;

        Ok(SearchIndexAddProcessorOutput::Ok {
            index: input.index,
        })
    }

    async fn reindex(
        &self,
        input: SearchIndexReindexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SearchIndexReindexOutput, Box<dyn std::error::Error>> {
        let index_record = storage.get("search-index", &input.index).await?;
        if index_record.is_none() {
            return Ok(SearchIndexReindexOutput::Notfound {
                index: input.index,
            });
        }

        // Re-tokenize all items in the index
        let items = storage.find("search-item", Some(&json!({"index": input.index}))).await?;
        let count = items.len() as i64;

        for item in &items {
            let data = item.get("data").and_then(|v| v.as_str()).unwrap_or("");
            let tokens: Vec<String> = data
                .to_lowercase()
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();

            let item_id = item.get("item").and_then(|v| v.as_str()).unwrap_or("");
            let item_key = format!("{}:{}", input.index, item_id);

            let mut updated = item.clone();
            updated["tokens"] = json!(tokens);
            updated["reindexedAt"] = json!(chrono::Utc::now().to_rfc3339());
            storage.put("search-item", &item_key, updated).await?;
        }

        Ok(SearchIndexReindexOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_index_success() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        let result = handler.create_index(
            SearchIndexCreateIndexInput { index: "docs".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexCreateIndexOutput::Ok { index } => {
                assert_eq!(index, "docs");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_index_exists() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        handler.create_index(
            SearchIndexCreateIndexInput { index: "docs".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create_index(
            SearchIndexCreateIndexInput { index: "docs".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexCreateIndexOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_index_item_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        let result = handler.index_item(
            SearchIndexIndexItemInput { index: "missing".to_string(), item: "i1".to_string(), data: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexIndexItemOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_search_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        let result = handler.search(
            SearchIndexSearchInput { index: "missing".to_string(), query: "hello".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexSearchOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_add_processor_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        let result = handler.add_processor(
            SearchIndexAddProcessorInput { index: "missing".to_string(), processor: "stemmer".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexAddProcessorOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reindex_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SearchIndexHandlerImpl;
        let result = handler.reindex(
            SearchIndexReindexInput { index: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SearchIndexReindexOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
