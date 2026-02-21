// Reference Concept Implementation (Rust)
//
// Manages directional references between entities — add, remove,
// and list outgoing references from a source.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- AddRef ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddRefInput {
    pub source_id: String,
    pub target_id: String,
    pub ref_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddRefOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
}

// --- RemoveRef ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveRefInput {
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveRefOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- GetRefs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetRefsInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetRefsOutput {
    #[serde(rename = "ok")]
    Ok { source_id: String, refs: String },
}

pub struct ReferenceHandler;

impl ReferenceHandler {
    pub async fn add_ref(
        &self,
        input: AddRefInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddRefOutput> {
        let compound_key = format!("{}:{}", input.source_id, input.target_id);
        storage
            .put(
                "reference",
                &compound_key,
                json!({
                    "source_id": input.source_id,
                    "target_id": input.target_id,
                    "ref_type": input.ref_type,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(AddRefOutput::Ok {
            source_id: input.source_id,
            target_id: input.target_id,
        })
    }

    pub async fn remove_ref(
        &self,
        input: RemoveRefInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveRefOutput> {
        let compound_key = format!("{}:{}", input.source_id, input.target_id);
        let existing = storage.get("reference", &compound_key).await?;
        match existing {
            None => Ok(RemoveRefOutput::NotFound {
                message: format!(
                    "reference from '{}' to '{}' not found",
                    input.source_id, input.target_id
                ),
            }),
            Some(_) => {
                storage.del("reference", &compound_key).await?;
                Ok(RemoveRefOutput::Ok {
                    source_id: input.source_id,
                    target_id: input.target_id,
                })
            }
        }
    }

    pub async fn get_refs(
        &self,
        input: GetRefsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetRefsOutput> {
        let all_refs = storage
            .find(
                "reference",
                Some(&json!({ "source_id": input.source_id })),
            )
            .await?;
        let refs_json = serde_json::to_string(&all_refs)?;
        Ok(GetRefsOutput::Ok {
            source_id: input.source_id,
            refs: refs_json,
        })
    }
}
