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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- check ---

    #[tokio::test]
    async fn check_returns_neutral_result() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .check(
                CheckInput {
                    entity_id: "doc1".into(),
                    operation: "read".into(),
                    user_id: "user1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CheckOutput::Ok { result, .. } => {
                assert_eq!(result, "neutral");
            }
        }
    }

    #[tokio::test]
    async fn check_includes_cache_tags() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .check(
                CheckInput {
                    entity_id: "doc42".into(),
                    operation: "write".into(),
                    user_id: "admin".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CheckOutput::Ok { cache_tags, .. } => {
                assert!(cache_tags.contains("entity:doc42"));
                assert!(cache_tags.contains("user:admin"));
                assert!(cache_tags.contains("op:write"));
            }
        }
    }

    // --- or_if ---

    #[tokio::test]
    async fn or_if_allowed_when_one_allowed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .or_if(
                OrIfInput {
                    result_a: "allowed".into(),
                    result_b: "neutral".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            OrIfOutput::Ok { result } => assert_eq!(result, "allowed"),
        }
    }

    #[tokio::test]
    async fn or_if_forbidden_overrides_allowed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .or_if(
                OrIfInput {
                    result_a: "allowed".into(),
                    result_b: "forbidden".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            OrIfOutput::Ok { result } => assert_eq!(result, "forbidden"),
        }
    }

    #[tokio::test]
    async fn or_if_neutral_when_both_neutral() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .or_if(
                OrIfInput {
                    result_a: "neutral".into(),
                    result_b: "neutral".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            OrIfOutput::Ok { result } => assert_eq!(result, "neutral"),
        }
    }

    // --- and_if ---

    #[tokio::test]
    async fn and_if_allowed_when_both_allowed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .and_if(
                AndIfInput {
                    result_a: "allowed".into(),
                    result_b: "allowed".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AndIfOutput::Ok { result } => assert_eq!(result, "allowed"),
        }
    }

    #[tokio::test]
    async fn and_if_forbidden_when_one_forbidden() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .and_if(
                AndIfInput {
                    result_a: "allowed".into(),
                    result_b: "forbidden".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AndIfOutput::Ok { result } => assert_eq!(result, "forbidden"),
        }
    }

    #[tokio::test]
    async fn and_if_neutral_when_one_neutral() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandler;

        let result = handler
            .and_if(
                AndIfInput {
                    result_a: "allowed".into(),
                    result_b: "neutral".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AndIfOutput::Ok { result } => assert_eq!(result, "neutral"),
        }
    }
}
