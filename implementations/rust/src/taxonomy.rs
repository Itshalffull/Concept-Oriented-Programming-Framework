// Taxonomy Concept Implementation (Rust)
//
// Manages hierarchical vocabularies with terms and entity tagging.
// See Architecture doc Sections on classification kit.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateVocabulary ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVocabularyInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateVocabularyOutput {
    #[serde(rename = "ok")]
    Ok { vocab_id: String },
}

// ── AddTerm ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddTermInput {
    pub vocab_id: String,
    pub name: String,
    pub parent_term_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddTermOutput {
    #[serde(rename = "ok")]
    Ok { term_id: String },
    #[serde(rename = "vocab_notfound")]
    VocabNotFound { message: String },
}

// ── SetParent ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetParentInput {
    pub term_id: String,
    pub parent_term_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetParentOutput {
    #[serde(rename = "ok")]
    Ok { term_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── TagEntity ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagEntityInput {
    pub node_id: String,
    pub term_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TagEntityOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, term_id: String },
}

// ── UntagEntity ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UntagEntityInput {
    pub node_id: String,
    pub term_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum UntagEntityOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, term_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct TaxonomyHandler;

impl TaxonomyHandler {
    pub async fn create_vocabulary(
        &self,
        input: CreateVocabularyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateVocabularyOutput> {
        let vocab_id = format!("vocab_{}", input.name.to_lowercase().replace(' ', "_"));

        storage
            .put(
                "vocabulary",
                &vocab_id,
                json!({ "vocab_id": vocab_id, "name": input.name }),
            )
            .await?;

        Ok(CreateVocabularyOutput::Ok { vocab_id })
    }

    pub async fn add_term(
        &self,
        input: AddTermInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddTermOutput> {
        let vocab = storage.get("vocabulary", &input.vocab_id).await?;
        if vocab.is_none() {
            return Ok(AddTermOutput::VocabNotFound {
                message: format!("Vocabulary '{}' not found", input.vocab_id),
            });
        }

        let term_id = format!(
            "term_{}_{}",
            input.vocab_id,
            input.name.to_lowercase().replace(' ', "_")
        );

        storage
            .put(
                "term",
                &term_id,
                json!({
                    "term_id": term_id,
                    "vocab_id": input.vocab_id,
                    "name": input.name,
                    "parent_term_id": input.parent_term_id,
                }),
            )
            .await?;

        // Update term_index for lookups by vocab
        let index_key = format!("idx_{}", input.vocab_id);
        let existing = storage.get("term_index", &index_key).await?;
        let mut term_ids: Vec<String> = match &existing {
            Some(record) => record["term_ids"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            None => vec![],
        };

        if !term_ids.contains(&term_id) {
            term_ids.push(term_id.clone());
        }

        storage
            .put(
                "term_index",
                &index_key,
                json!({ "vocab_id": input.vocab_id, "term_ids": term_ids }),
            )
            .await?;

        Ok(AddTermOutput::Ok { term_id })
    }

    pub async fn set_parent(
        &self,
        input: SetParentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetParentOutput> {
        let existing = storage.get("term", &input.term_id).await?;

        match existing {
            None => Ok(SetParentOutput::NotFound {
                message: format!("Term '{}' not found", input.term_id),
            }),
            Some(mut term) => {
                term["parent_term_id"] = json!(input.parent_term_id);
                storage.put("term", &input.term_id, term).await?;
                Ok(SetParentOutput::Ok {
                    term_id: input.term_id,
                })
            }
        }
    }

    pub async fn tag_entity(
        &self,
        input: TagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagEntityOutput> {
        let key = format!("{}:{}", input.node_id, input.term_id);
        storage
            .put(
                "term_index",
                &key,
                json!({ "node_id": input.node_id, "term_id": input.term_id }),
            )
            .await?;

        Ok(TagEntityOutput::Ok {
            node_id: input.node_id,
            term_id: input.term_id,
        })
    }

    pub async fn untag_entity(
        &self,
        input: UntagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UntagEntityOutput> {
        let key = format!("{}:{}", input.node_id, input.term_id);
        let existing = storage.get("term_index", &key).await?;

        if existing.is_none() {
            return Ok(UntagEntityOutput::NotFound {
                message: format!(
                    "Entity '{}' not tagged with term '{}'",
                    input.node_id, input.term_id
                ),
            });
        }

        storage.del("term_index", &key).await?;

        Ok(UntagEntityOutput::Ok {
            node_id: input.node_id,
            term_id: input.term_id,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── create_vocabulary tests ────────────────────────────

    #[tokio::test]
    async fn create_vocabulary_returns_deterministic_id() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        let result = handler
            .create_vocabulary(
                CreateVocabularyInput {
                    name: "Colors".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CreateVocabularyOutput::Ok { vocab_id } => {
                assert_eq!(vocab_id, "vocab_colors");
            }
        }
    }

    #[tokio::test]
    async fn create_vocabulary_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        handler
            .create_vocabulary(
                CreateVocabularyInput {
                    name: "Topics".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("vocabulary", "vocab_topics").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["name"].as_str().unwrap(), "Topics");
    }

    // ── add_term tests ─────────────────────────────────────

    #[tokio::test]
    async fn add_term_returns_term_id() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        handler
            .create_vocabulary(
                CreateVocabularyInput {
                    name: "Tags".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .add_term(
                AddTermInput {
                    vocab_id: "vocab_tags".into(),
                    name: "Important".into(),
                    parent_term_id: None,
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AddTermOutput::Ok { term_id } => {
                assert!(term_id.contains("vocab_tags"));
                assert!(term_id.contains("important"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn add_term_returns_vocab_notfound_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        let result = handler
            .add_term(
                AddTermInput {
                    vocab_id: "nonexistent".into(),
                    name: "Term".into(),
                    parent_term_id: None,
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddTermOutput::VocabNotFound { .. }));
    }

    // ── set_parent tests ───────────────────────────────────

    #[tokio::test]
    async fn set_parent_updates_term_parent() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        handler
            .create_vocabulary(
                CreateVocabularyInput {
                    name: "Categories".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let parent_result = handler
            .add_term(
                AddTermInput {
                    vocab_id: "vocab_categories".into(),
                    name: "Root".into(),
                    parent_term_id: None,
                },
                &storage,
            )
            .await
            .unwrap();

        let parent_id = match parent_result {
            AddTermOutput::Ok { term_id } => term_id,
            _ => panic!("expected Ok"),
        };

        let child_result = handler
            .add_term(
                AddTermInput {
                    vocab_id: "vocab_categories".into(),
                    name: "Child".into(),
                    parent_term_id: None,
                },
                &storage,
            )
            .await
            .unwrap();

        let child_id = match child_result {
            AddTermOutput::Ok { term_id } => term_id,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .set_parent(
                SetParentInput {
                    term_id: child_id.clone(),
                    parent_term_id: parent_id.clone(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetParentOutput::Ok { .. }));

        let term_record = storage.get("term", &child_id).await.unwrap().unwrap();
        assert_eq!(term_record["parent_term_id"].as_str().unwrap(), parent_id);
    }

    #[tokio::test]
    async fn set_parent_returns_notfound_for_missing_term() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        let result = handler
            .set_parent(
                SetParentInput {
                    term_id: "nonexistent".into(),
                    parent_term_id: "parent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, SetParentOutput::NotFound { .. }));
    }

    // ── tag_entity tests ───────────────────────────────────

    #[tokio::test]
    async fn tag_entity_creates_tag_association() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        let result = handler
            .tag_entity(
                TagEntityInput {
                    node_id: "article_1".into(),
                    term_id: "term_news".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            TagEntityOutput::Ok { node_id, term_id } => {
                assert_eq!(node_id, "article_1");
                assert_eq!(term_id, "term_news");
            }
        }

        let record = storage
            .get("term_index", "article_1:term_news")
            .await
            .unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn tag_entity_supports_multiple_tags() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        handler
            .tag_entity(
                TagEntityInput {
                    node_id: "doc1".into(),
                    term_id: "term_a".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .tag_entity(
                TagEntityInput {
                    node_id: "doc1".into(),
                    term_id: "term_b".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let r1 = storage.get("term_index", "doc1:term_a").await.unwrap();
        let r2 = storage.get("term_index", "doc1:term_b").await.unwrap();
        assert!(r1.is_some());
        assert!(r2.is_some());
    }

    // ── untag_entity tests ─────────────────────────────────

    #[tokio::test]
    async fn untag_entity_removes_tag() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        handler
            .tag_entity(
                TagEntityInput {
                    node_id: "doc1".into(),
                    term_id: "term_x".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .untag_entity(
                UntagEntityInput {
                    node_id: "doc1".into(),
                    term_id: "term_x".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, UntagEntityOutput::Ok { .. }));

        let record = storage.get("term_index", "doc1:term_x").await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn untag_entity_returns_notfound_when_not_tagged() {
        let storage = InMemoryStorage::new();
        let handler = TaxonomyHandler;

        let result = handler
            .untag_entity(
                UntagEntityInput {
                    node_id: "doc1".into(),
                    term_id: "untagged".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, UntagEntityOutput::NotFound { .. }));
    }
}
