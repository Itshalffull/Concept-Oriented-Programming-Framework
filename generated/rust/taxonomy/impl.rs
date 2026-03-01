// Taxonomy Handler Implementation
//
// Hierarchical vocabulary management with terms, parent-child relationships,
// and entity tagging. Supports multiple vocabularies, each containing a tree
// of terms that can be applied to arbitrary entities.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TaxonomyHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct TaxonomyHandlerImpl;

#[async_trait]
impl TaxonomyHandler for TaxonomyHandlerImpl {
    async fn create_vocabulary(
        &self,
        input: TaxonomyCreateVocabularyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyCreateVocabularyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("taxonomy", &input.vocab).await?;
        if existing.is_some() {
            return Ok(TaxonomyCreateVocabularyOutput::Exists {
                message: "Vocabulary already exists".to_string(),
            });
        }

        storage.put("taxonomy", &input.vocab, json!({
            "vocab": input.vocab,
            "name": input.name,
            "terms": "[]",
            "termParents": "{}",
            "termIndex": "{}",
        })).await?;

        Ok(TaxonomyCreateVocabularyOutput::Ok)
    }

    async fn add_term(
        &self,
        input: TaxonomyAddTermInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyAddTermOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("taxonomy", &input.vocab).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(TaxonomyAddTermOutput::Notfound {
                    message: "Vocabulary not found".to_string(),
                });
            }
        };

        let terms_str = existing["terms"].as_str().unwrap_or("[]");
        let mut terms: Vec<String> = serde_json::from_str(terms_str)?;

        let parents_str = existing["termParents"].as_str().unwrap_or("{}");
        let mut term_parents: HashMap<String, String> = serde_json::from_str(parents_str)?;

        let index_str = existing["termIndex"].as_str().unwrap_or("{}");
        let mut term_index: HashMap<String, Vec<String>> = serde_json::from_str(index_str)?;

        if !terms.contains(&input.term) {
            terms.push(input.term.clone());
        }

        // Only set parent if a parent was specified and the parent term exists
        if let Some(ref parent) = input.parent {
            if terms.contains(parent) {
                term_parents.insert(input.term.clone(), parent.clone());
            }
        }

        if !term_index.contains_key(&input.term) {
            term_index.insert(input.term.clone(), Vec::new());
        }

        let mut updated = existing.clone();
        updated["terms"] = json!(serde_json::to_string(&terms)?);
        updated["termParents"] = json!(serde_json::to_string(&term_parents)?);
        updated["termIndex"] = json!(serde_json::to_string(&term_index)?);
        storage.put("taxonomy", &input.vocab, updated).await?;

        Ok(TaxonomyAddTermOutput::Ok)
    }

    async fn set_parent(
        &self,
        input: TaxonomySetParentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomySetParentOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("taxonomy", &input.vocab).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(TaxonomySetParentOutput::Notfound {
                    message: "Vocabulary not found".to_string(),
                });
            }
        };

        let terms_str = existing["terms"].as_str().unwrap_or("[]");
        let terms: Vec<String> = serde_json::from_str(terms_str)?;

        if !terms.contains(&input.term) {
            return Ok(TaxonomySetParentOutput::Notfound {
                message: "Term not found".to_string(),
            });
        }

        if !terms.contains(&input.parent) {
            return Ok(TaxonomySetParentOutput::Notfound {
                message: "Parent term not found".to_string(),
            });
        }

        let parents_str = existing["termParents"].as_str().unwrap_or("{}");
        let mut term_parents: HashMap<String, String> = serde_json::from_str(parents_str)?;
        term_parents.insert(input.term.clone(), input.parent.clone());

        let mut updated = existing.clone();
        updated["termParents"] = json!(serde_json::to_string(&term_parents)?);
        storage.put("taxonomy", &input.vocab, updated).await?;

        Ok(TaxonomySetParentOutput::Ok)
    }

    async fn tag_entity(
        &self,
        input: TaxonomyTagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyTagEntityOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("taxonomy", &input.vocab).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(TaxonomyTagEntityOutput::Notfound {
                    message: "Vocabulary not found".to_string(),
                });
            }
        };

        let terms_str = existing["terms"].as_str().unwrap_or("[]");
        let terms: Vec<String> = serde_json::from_str(terms_str)?;

        if !terms.contains(&input.term) {
            return Ok(TaxonomyTagEntityOutput::Notfound {
                message: "Term not found".to_string(),
            });
        }

        let index_str = existing["termIndex"].as_str().unwrap_or("{}");
        let mut term_index: HashMap<String, Vec<String>> = serde_json::from_str(index_str)?;

        let entities = term_index.entry(input.term.clone()).or_insert_with(Vec::new);
        if !entities.contains(&input.entity) {
            entities.push(input.entity.clone());
        }

        let mut updated = existing.clone();
        updated["termIndex"] = json!(serde_json::to_string(&term_index)?);
        storage.put("taxonomy", &input.vocab, updated).await?;

        Ok(TaxonomyTagEntityOutput::Ok)
    }

    async fn untag_entity(
        &self,
        input: TaxonomyUntagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyUntagEntityOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("taxonomy", &input.vocab).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(TaxonomyUntagEntityOutput::Notfound {
                    message: "Vocabulary not found".to_string(),
                });
            }
        };

        let terms_str = existing["terms"].as_str().unwrap_or("[]");
        let terms: Vec<String> = serde_json::from_str(terms_str)?;

        if !terms.contains(&input.term) {
            return Ok(TaxonomyUntagEntityOutput::Notfound {
                message: "Term not found".to_string(),
            });
        }

        let index_str = existing["termIndex"].as_str().unwrap_or("{}");
        let mut term_index: HashMap<String, Vec<String>> = serde_json::from_str(index_str)?;

        let entities = term_index.get(&input.term);
        match entities {
            Some(list) if list.contains(&input.entity) => {}
            _ => {
                return Ok(TaxonomyUntagEntityOutput::Notfound {
                    message: "Entity is not associated with this term".to_string(),
                });
            }
        }

        if let Some(list) = term_index.get_mut(&input.term) {
            list.retain(|e| e != &input.entity);
        }

        let mut updated = existing.clone();
        updated["termIndex"] = json!(serde_json::to_string(&term_index)?);
        storage.put("taxonomy", &input.vocab, updated).await?;

        Ok(TaxonomyUntagEntityOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_vocabulary() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        let result = handler.create_vocabulary(
            TaxonomyCreateVocabularyInput {
                vocab: "categories".to_string(),
                name: "Content Categories".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyCreateVocabularyOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_vocabulary_exists() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "tags".to_string(), name: "Tags".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "tags".to_string(), name: "Tags".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyCreateVocabularyOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_add_term() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "cat".to_string(), name: "Categories".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.add_term(
            TaxonomyAddTermInput { vocab: "cat".to_string(), term: "news".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyAddTermOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_term_vocab_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        let result = handler.add_term(
            TaxonomyAddTermInput { vocab: "nonexistent".to_string(), term: "test".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyAddTermOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_tag_entity() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "cat".to_string(), name: "Categories".to_string() },
            &storage,
        ).await.unwrap();
        handler.add_term(
            TaxonomyAddTermInput { vocab: "cat".to_string(), term: "tech".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        let result = handler.tag_entity(
            TaxonomyTagEntityInput { entity: "article-1".to_string(), vocab: "cat".to_string(), term: "tech".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyTagEntityOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_untag_entity_not_tagged() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "cat".to_string(), name: "Categories".to_string() },
            &storage,
        ).await.unwrap();
        handler.add_term(
            TaxonomyAddTermInput { vocab: "cat".to_string(), term: "tech".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        let result = handler.untag_entity(
            TaxonomyUntagEntityInput { entity: "article-1".to_string(), vocab: "cat".to_string(), term: "tech".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomyUntagEntityOutput::Notfound { message } => {
                assert!(message.contains("not associated"));
            },
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_parent() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandlerImpl;
        handler.create_vocabulary(
            TaxonomyCreateVocabularyInput { vocab: "cat".to_string(), name: "Categories".to_string() },
            &storage,
        ).await.unwrap();
        handler.add_term(
            TaxonomyAddTermInput { vocab: "cat".to_string(), term: "tech".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        handler.add_term(
            TaxonomyAddTermInput { vocab: "cat".to_string(), term: "rust".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        let result = handler.set_parent(
            TaxonomySetParentInput { vocab: "cat".to_string(), term: "rust".to_string(), parent: "tech".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TaxonomySetParentOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }
}
