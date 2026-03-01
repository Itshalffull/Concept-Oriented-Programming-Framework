// AccessControl concept implementation
// Evaluate three-valued access decisions (allowed/forbidden/neutral) with cacheable results.
// Policies are composable via logical OR and AND combinators.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AccessControlHandler;
use serde_json::json;

pub struct AccessControlHandlerImpl;

#[async_trait]
impl AccessControlHandler for AccessControlHandlerImpl {
    async fn check(
        &self,
        input: AccessControlCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AccessControlCheckOutput, Box<dyn std::error::Error>> {
        let policy_key = format!("{}:{}", input.resource, input.action);
        let policy_record = storage.get("policy", &policy_key).await?;

        if let Some(record) = policy_record {
            let result = record["result"].as_str().unwrap_or("forbidden").to_string();
            let tags = record["tags"].as_str().unwrap_or("").to_string();
            let max_age = record["maxAge"].as_i64().unwrap_or(60);

            Ok(AccessControlCheckOutput::Ok {
                result,
                tags,
                max_age,
            })
        } else {
            // No explicit policy: read actions are allowed by default; mutating actions are forbidden
            let read_actions = ["read", "view", "list", "get"];
            let result = if read_actions.contains(&input.action.as_str()) {
                "allowed"
            } else {
                "forbidden"
            };
            let tags = format!("{}:{}:{}", input.resource, input.action, input.context);
            let max_age = if result == "allowed" { 300 } else { 60 };

            Ok(AccessControlCheckOutput::Ok {
                result: result.to_string(),
                tags,
                max_age,
            })
        }
    }

    async fn or_if(
        &self,
        input: AccessControlOrIfInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<AccessControlOrIfOutput, Box<dyn std::error::Error>> {
        // Forbidden takes precedence over everything
        if input.left == "forbidden" || input.right == "forbidden" {
            return Ok(AccessControlOrIfOutput::Ok {
                result: "forbidden".to_string(),
            });
        }

        // Allowed if either is allowed
        if input.left == "allowed" || input.right == "allowed" {
            return Ok(AccessControlOrIfOutput::Ok {
                result: "allowed".to_string(),
            });
        }

        // Both must be neutral
        Ok(AccessControlOrIfOutput::Ok {
            result: "neutral".to_string(),
        })
    }

    async fn and_if(
        &self,
        input: AccessControlAndIfInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<AccessControlAndIfOutput, Box<dyn std::error::Error>> {
        // Forbidden wins over everything
        if input.left == "forbidden" || input.right == "forbidden" {
            return Ok(AccessControlAndIfOutput::Ok {
                result: "forbidden".to_string(),
            });
        }

        // Allowed only if both are allowed
        if input.left == "allowed" && input.right == "allowed" {
            return Ok(AccessControlAndIfOutput::Ok {
                result: "allowed".to_string(),
            });
        }

        // Otherwise neutral (at least one is neutral, neither is forbidden)
        Ok(AccessControlAndIfOutput::Ok {
            result: "neutral".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_check_read_action_allowed_by_default() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.check(
            AccessControlCheckInput {
                resource: "article".to_string(),
                action: "read".to_string(),
                context: "public".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlCheckOutput::Ok { result, max_age, .. } => {
                assert_eq!(result, "allowed");
                assert_eq!(max_age, 300);
            }
        }
    }

    #[tokio::test]
    async fn test_check_write_action_forbidden_by_default() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.check(
            AccessControlCheckInput {
                resource: "article".to_string(),
                action: "write".to_string(),
                context: "public".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlCheckOutput::Ok { result, max_age, .. } => {
                assert_eq!(result, "forbidden");
                assert_eq!(max_age, 60);
            }
        }
    }

    #[tokio::test]
    async fn test_check_with_stored_policy() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        storage.put("policy", "article:delete", json!({
            "result": "allowed",
            "tags": "admin",
            "maxAge": 120,
        })).await.unwrap();
        let result = handler.check(
            AccessControlCheckInput {
                resource: "article".to_string(),
                action: "delete".to_string(),
                context: "admin".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlCheckOutput::Ok { result, tags, max_age } => {
                assert_eq!(result, "allowed");
                assert_eq!(tags, "admin");
                assert_eq!(max_age, 120);
            }
        }
    }

    #[tokio::test]
    async fn test_or_if_forbidden_takes_precedence() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.or_if(
            AccessControlOrIfInput {
                left: "forbidden".to_string(),
                right: "allowed".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlOrIfOutput::Ok { result } => {
                assert_eq!(result, "forbidden");
            }
        }
    }

    #[tokio::test]
    async fn test_or_if_allowed_if_either_allowed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.or_if(
            AccessControlOrIfInput {
                left: "neutral".to_string(),
                right: "allowed".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlOrIfOutput::Ok { result } => {
                assert_eq!(result, "allowed");
            }
        }
    }

    #[tokio::test]
    async fn test_or_if_neutral_when_both_neutral() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.or_if(
            AccessControlOrIfInput {
                left: "neutral".to_string(),
                right: "neutral".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlOrIfOutput::Ok { result } => {
                assert_eq!(result, "neutral");
            }
        }
    }

    #[tokio::test]
    async fn test_and_if_forbidden_wins() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.and_if(
            AccessControlAndIfInput {
                left: "allowed".to_string(),
                right: "forbidden".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlAndIfOutput::Ok { result } => {
                assert_eq!(result, "forbidden");
            }
        }
    }

    #[tokio::test]
    async fn test_and_if_allowed_only_when_both_allowed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.and_if(
            AccessControlAndIfInput {
                left: "allowed".to_string(),
                right: "allowed".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlAndIfOutput::Ok { result } => {
                assert_eq!(result, "allowed");
            }
        }
    }

    #[tokio::test]
    async fn test_and_if_neutral_when_mixed() {
        let storage = InMemoryStorage::new();
        let handler = AccessControlHandlerImpl;
        let result = handler.and_if(
            AccessControlAndIfInput {
                left: "allowed".to_string(),
                right: "neutral".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AccessControlAndIfOutput::Ok { result } => {
                assert_eq!(result, "neutral");
            }
        }
    }
}
