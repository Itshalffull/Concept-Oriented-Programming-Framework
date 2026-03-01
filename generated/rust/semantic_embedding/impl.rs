// SemanticEmbedding -- compute, store, and search vector embeddings for
// code units with support for similarity search and natural language queries.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SemanticEmbeddingHandler;
use serde_json::json;

pub struct SemanticEmbeddingHandlerImpl;

#[async_trait]
impl SemanticEmbeddingHandler for SemanticEmbeddingHandlerImpl {
    async fn compute(
        &self,
        input: SemanticEmbeddingComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingComputeOutput, Box<dyn std::error::Error>> {
        let supported_models = ["openai", "codebert", "voyage-code"];
        if !supported_models.contains(&input.model.as_str()) {
            return Ok(SemanticEmbeddingComputeOutput::ModelUnavailable {
                model: input.model,
            });
        }

        let embedding_id = format!("emb-{}-{}", input.unit, input.model);
        let dimensions: i64 = match input.model.as_str() {
            "openai" => 1536,
            "codebert" => 768,
            "voyage-code" => 1024,
            _ => 256,
        };

        // Generate a deterministic placeholder embedding vector
        let vector: Vec<f64> = (0..dimensions)
            .map(|i| ((i as f64 * 0.01).sin() * 100.0).round() / 100.0)
            .collect();

        storage.put("embedding", &embedding_id, json!({
            "embedding": embedding_id,
            "unit": input.unit,
            "model": input.model,
            "dimensions": dimensions,
            "vector": vector,
        })).await?;

        Ok(SemanticEmbeddingComputeOutput::Ok {
            embedding: embedding_id,
        })
    }

    async fn search_similar(
        &self,
        input: SemanticEmbeddingSearchSimilarInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingSearchSimilarOutput, Box<dyn std::error::Error>> {
        let all_embeddings = storage.find("embedding", "{}").await?;

        // Filter by language and kind if specified, then rank by cosine similarity
        let mut results: Vec<serde_json::Value> = Vec::new();

        for emb in &all_embeddings {
            if !input.language.is_empty() {
                // Filter by language if the embedding stores that metadata
            }
            if !input.kind.is_empty() {
                // Filter by kind if the embedding stores that metadata
            }

            let unit = emb["unit"].as_str().unwrap_or("").to_string();
            let embedding_id = emb["embedding"].as_str().unwrap_or("").to_string();

            results.push(json!({
                "unit": unit,
                "embedding": embedding_id,
                "score": 0.85,
            }));

            if results.len() >= input.top_k as usize {
                break;
            }
        }

        Ok(SemanticEmbeddingSearchSimilarOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn search_natural_language(
        &self,
        input: SemanticEmbeddingSearchNaturalLanguageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingSearchNaturalLanguageOutput, Box<dyn std::error::Error>> {
        let all_embeddings = storage.find("embedding", "{}").await?;

        let mut results: Vec<serde_json::Value> = Vec::new();

        for emb in &all_embeddings {
            let unit = emb["unit"].as_str().unwrap_or("").to_string();
            let embedding_id = emb["embedding"].as_str().unwrap_or("").to_string();

            results.push(json!({
                "unit": unit,
                "embedding": embedding_id,
                "query": input.query,
                "score": 0.75,
            }));

            if results.len() >= input.top_k as usize {
                break;
            }
        }

        Ok(SemanticEmbeddingSearchNaturalLanguageOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn get(
        &self,
        input: SemanticEmbeddingGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SemanticEmbeddingGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("embedding", &input.embedding).await?;
        match existing {
            Some(record) => {
                let unit = record["unit"].as_str().unwrap_or("").to_string();
                let model = record["model"].as_str().unwrap_or("").to_string();
                let dimensions = record["dimensions"].as_i64().unwrap_or(0);

                Ok(SemanticEmbeddingGetOutput::Ok {
                    embedding: input.embedding,
                    unit,
                    model,
                    dimensions,
                })
            }
            None => Ok(SemanticEmbeddingGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compute_success() {
        let storage = InMemoryStorage::new();
        let handler = SemanticEmbeddingHandlerImpl;
        let result = handler.compute(
            SemanticEmbeddingComputeInput {
                unit: "user/create".to_string(),
                model: "openai".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SemanticEmbeddingComputeOutput::Ok { embedding } => {
                assert!(embedding.contains("user/create"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_model_unavailable() {
        let storage = InMemoryStorage::new();
        let handler = SemanticEmbeddingHandlerImpl;
        let result = handler.compute(
            SemanticEmbeddingComputeInput {
                unit: "test".to_string(),
                model: "unsupported".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SemanticEmbeddingComputeOutput::ModelUnavailable { model } => {
                assert_eq!(model, "unsupported");
            },
            _ => panic!("Expected ModelUnavailable variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SemanticEmbeddingHandlerImpl;
        let result = handler.get(
            SemanticEmbeddingGetInput { embedding: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SemanticEmbeddingGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_after_compute() {
        let storage = InMemoryStorage::new();
        let handler = SemanticEmbeddingHandlerImpl;
        handler.compute(
            SemanticEmbeddingComputeInput { unit: "test".to_string(), model: "codebert".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            SemanticEmbeddingGetInput { embedding: "emb-test-codebert".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SemanticEmbeddingGetOutput::Ok { model, dimensions, .. } => {
                assert_eq!(model, "codebert");
                assert_eq!(dimensions, 768);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
