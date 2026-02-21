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
