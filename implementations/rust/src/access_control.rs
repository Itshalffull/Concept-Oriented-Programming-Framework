// AccessControl Concept Implementation (Rust)
//
// Purely computational access control checks with combinators
// for composing access decisions (or_if, and_if).

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};

// --- Check ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckInput {
    pub entity_id: String,
    pub operation: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CheckOutput {
    #[serde(rename = "ok")]
    Ok { result: String, cache_tags: String },
}

// --- OrIf ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrIfInput {
    pub result_a: String,
    pub result_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum OrIfOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
}

// --- AndIf ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndIfInput {
    pub result_a: String,
    pub result_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AndIfOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
}

pub struct AccessControlHandler;

impl AccessControlHandler {
    pub async fn check(
        &self,
        input: CheckInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<CheckOutput> {
        // Default access check returns "neutral" — real policy evaluation
        // would be layered on top by composing multiple checks.
        let cache_tags = serde_json::to_string(&vec![
            format!("entity:{}", input.entity_id),
            format!("user:{}", input.user_id),
            format!("op:{}", input.operation),
        ])?;

        Ok(CheckOutput::Ok {
            result: "neutral".to_string(),
            cache_tags,
        })
    }

    pub async fn or_if(
        &self,
        input: OrIfInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<OrIfOutput> {
        // or_if: any allowed + none forbidden = "allowed"
        let a = &input.result_a;
        let b = &input.result_b;

        let result = if a == "forbidden" || b == "forbidden" {
            "forbidden"
        } else if a == "allowed" || b == "allowed" {
            "allowed"
        } else {
            "neutral"
        };

        Ok(OrIfOutput::Ok {
            result: result.to_string(),
        })
    }

    pub async fn and_if(
        &self,
        input: AndIfInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<AndIfOutput> {
        // and_if: all must be "allowed"
        let a = &input.result_a;
        let b = &input.result_b;

        let result = if a == "forbidden" || b == "forbidden" {
            "forbidden"
        } else if a == "allowed" && b == "allowed" {
            "allowed"
        } else {
            "neutral"
        };

        Ok(AndIfOutput::Ok {
            result: result.to_string(),
        })
    }
}
