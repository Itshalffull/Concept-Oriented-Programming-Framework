// Transform concept implementation
// Apply, chain, and preview data transformations via pluggable transform providers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TransformHandler;
use serde_json::json;

pub struct TransformHandlerImpl;

/// Apply a single transform by plugin ID to a value string.
fn apply_plugin(plugin_id: &str, value: &str) -> String {
    match plugin_id {
        "slugify" => {
            let lower = value.to_lowercase();
            let slug: String = lower.chars().map(|c| {
                if c.is_ascii_alphanumeric() { c } else { '-' }
            }).collect();
            // Collapse consecutive dashes, trim leading/trailing dashes
            let mut result = String::new();
            let mut prev_dash = true; // treat start as dash to trim leading
            for ch in slug.chars() {
                if ch == '-' {
                    if !prev_dash { result.push('-'); }
                    prev_dash = true;
                } else {
                    result.push(ch);
                    prev_dash = false;
                }
            }
            result.trim_end_matches('-').to_string()
        }
        "strip_tags" => {
            let re = regex::Regex::new(r"<[^>]*>").unwrap();
            re.replace_all(value, "").to_string()
        }
        "html_to_markdown" => {
            let mut result = value.to_string();
            for (open, md) in &[("<b>", "**"), ("<strong>", "**"), ("<i>", "*"), ("<em>", "*")] {
                result = result.replace(open, md);
            }
            for (close, md) in &[("</b>", "**"), ("</strong>", "**"), ("</i>", "*"), ("</em>", "*")] {
                result = result.replace(close, md);
            }
            let re = regex::Regex::new(r"<[^>]*>").unwrap();
            re.replace_all(&result, "").to_string()
        }
        _ => value.to_string(),
    }
}

#[async_trait]
impl TransformHandler for TransformHandlerImpl {
    async fn apply(
        &self,
        input: TransformApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformApplyOutput, Box<dyn std::error::Error>> {
        let transform = storage.get("transform", &input.transform_id).await?;
        if transform.is_none() {
            return Ok(TransformApplyOutput::Notfound {
                message: format!("Transform \"{}\" not found", input.transform_id),
            });
        }

        let record = transform.unwrap();
        let plugin_id = record["pluginId"].as_str().unwrap_or("");
        let result = apply_plugin(plugin_id, &input.value);

        Ok(TransformApplyOutput::Ok { result })
    }

    async fn chain(
        &self,
        input: TransformChainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformChainOutput, Box<dyn std::error::Error>> {
        let ids: Vec<&str> = input.transform_ids.split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let mut current = input.value.clone();

        for id in &ids {
            let transform = storage.get("transform", id).await?;
            if transform.is_none() {
                return Ok(TransformChainOutput::Error {
                    message: format!("Transform \"{}\" not found", id),
                    failed_at: id.to_string(),
                });
            }
            let record = transform.unwrap();
            let plugin_id = record["pluginId"].as_str().unwrap_or("");
            current = apply_plugin(plugin_id, &current);
        }

        Ok(TransformChainOutput::Ok { result: current })
    }

    async fn preview(
        &self,
        input: TransformPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransformPreviewOutput, Box<dyn std::error::Error>> {
        let transform = storage.get("transform", &input.transform_id).await?;
        if transform.is_none() {
            return Ok(TransformPreviewOutput::Notfound {
                message: format!("Transform \"{}\" not found", input.transform_id),
            });
        }

        let record = transform.unwrap();
        let plugin_id = record["pluginId"].as_str().unwrap_or("");
        let after = apply_plugin(plugin_id, &input.value);

        Ok(TransformPreviewOutput::Ok {
            before: input.value,
            after,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn seed_transform(storage: &InMemoryStorage, id: &str, plugin_id: &str) {
        storage.put("transform", id, json!({
            "pluginId": plugin_id,
        })).await.unwrap();
    }

    #[tokio::test]
    async fn test_apply_slugify() {
        let storage = InMemoryStorage::new();
        seed_transform(&storage, "slug-transform", "slugify").await;
        let handler = TransformHandlerImpl;
        let result = handler.apply(
            TransformApplyInput {
                value: "Hello World!".to_string(),
                transform_id: "slug-transform".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformApplyOutput::Ok { result } => {
                assert_eq!(result, "hello-world");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TransformHandlerImpl;
        let result = handler.apply(
            TransformApplyInput {
                value: "test".to_string(),
                transform_id: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformApplyOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_strip_tags() {
        let storage = InMemoryStorage::new();
        seed_transform(&storage, "strip", "strip_tags").await;
        let handler = TransformHandlerImpl;
        let result = handler.apply(
            TransformApplyInput {
                value: "<b>bold</b> text".to_string(),
                transform_id: "strip".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformApplyOutput::Ok { result } => {
                assert_eq!(result, "bold text");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_chain_success() {
        let storage = InMemoryStorage::new();
        seed_transform(&storage, "strip", "strip_tags").await;
        seed_transform(&storage, "slug", "slugify").await;
        let handler = TransformHandlerImpl;
        let result = handler.chain(
            TransformChainInput {
                value: "<b>Hello World</b>".to_string(),
                transform_ids: "strip, slug".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformChainOutput::Ok { result } => {
                assert_eq!(result, "hello-world");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_chain_missing_transform() {
        let storage = InMemoryStorage::new();
        let handler = TransformHandlerImpl;
        let result = handler.chain(
            TransformChainInput {
                value: "test".to_string(),
                transform_ids: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformChainOutput::Error { failed_at, .. } => {
                assert_eq!(failed_at, "nonexistent");
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TransformHandlerImpl;
        let result = handler.preview(
            TransformPreviewInput {
                value: "test".to_string(),
                transform_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformPreviewOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_shows_before_and_after() {
        let storage = InMemoryStorage::new();
        seed_transform(&storage, "slug", "slugify").await;
        let handler = TransformHandlerImpl;
        let result = handler.preview(
            TransformPreviewInput {
                value: "Hello World".to_string(),
                transform_id: "slug".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransformPreviewOutput::Ok { before, after } => {
                assert_eq!(before, "Hello World");
                assert_eq!(after, "hello-world");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
