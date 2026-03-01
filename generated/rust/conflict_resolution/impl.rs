// Conflict Resolution -- detect and resolve concurrent modification conflicts
// Supports policy-based automatic resolution and manual human-in-the-loop resolution.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConflictResolutionHandler;
use serde_json::json;

pub struct ConflictResolutionHandlerImpl;

#[async_trait]
impl ConflictResolutionHandler for ConflictResolutionHandlerImpl {
    async fn register_policy(
        &self,
        input: ConflictResolutionRegisterPolicyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionRegisterPolicyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("policy", &input.name).await?;
        if existing.is_some() {
            return Ok(ConflictResolutionRegisterPolicyOutput::Duplicate {
                message: format!("Policy '{}' already registered", input.name),
            });
        }

        let policy = json!({
            "name": input.name,
            "priority": input.priority,
            "strategy": "last-writer-wins",
        });

        storage.put("policy", &input.name, policy.clone()).await?;

        Ok(ConflictResolutionRegisterPolicyOutput::Ok { policy })
    }

    async fn detect(
        &self,
        input: ConflictResolutionDetectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionDetectOutput, Box<dyn std::error::Error>> {
        // Compare version1 and version2; if they diverge from base, a conflict exists
        if input.version1 == input.version2 {
            return Ok(ConflictResolutionDetectOutput::NoConflict);
        }

        // If base is provided, check if both versions differ from base
        if let Some(ref base) = input.base {
            if input.version1 == *base || input.version2 == *base {
                // Only one side changed -- no conflict
                return Ok(ConflictResolutionDetectOutput::NoConflict);
            }
        }

        // Conflict detected -- generate a conflict record
        let counter = storage.get("conflict_meta", "counter").await?;
        let next_id = match counter {
            Some(val) => val["value"].as_i64().unwrap_or(0) + 1,
            None => 1,
        };
        storage.put("conflict_meta", "counter", json!({ "value": next_id })).await?;

        let conflict_id = json!(format!("conflict-{}", next_id));
        let detail = json!({
            "base": input.base,
            "version1": input.version1,
            "version2": input.version2,
            "context": input.context,
        });

        storage.put("conflict", &conflict_id.as_str().unwrap_or(""), json!({
            "conflictId": conflict_id,
            "status": "detected",
            "detail": detail,
        })).await?;

        Ok(ConflictResolutionDetectOutput::Detected {
            conflict_id,
            detail: serde_json::to_vec(&detail)?,
        })
    }

    async fn resolve(
        &self,
        input: ConflictResolutionResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionResolveOutput, Box<dyn std::error::Error>> {
        let conflict_key = input.conflict_id.as_str().unwrap_or("");
        let conflict = storage.get("conflict", conflict_key).await?;

        let record = match conflict {
            Some(r) => r,
            None => {
                return Ok(ConflictResolutionResolveOutput::NoPolicy {
                    message: "Conflict not found".to_string(),
                });
            }
        };

        // Find applicable policy
        let policy_name = input.policy_override.clone().unwrap_or_default();
        let policy = if policy_name.is_empty() {
            // Find highest-priority policy
            let policies = storage.find("policy", None).await?;
            policies.into_iter().max_by_key(|p| p["priority"].as_i64().unwrap_or(0))
        } else {
            storage.get("policy", &policy_name).await?
        };

        match policy {
            Some(_p) => {
                // Apply the policy: last-writer-wins takes version2 by default
                let detail = &record["detail"];
                let result = detail["version2"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                updated["status"] = json!("resolved");
                storage.put("conflict", conflict_key, updated).await?;

                Ok(ConflictResolutionResolveOutput::Resolved { result })
            }
            None => {
                // No policy available, requires human resolution
                let v1 = record["detail"]["version1"].as_str().unwrap_or("").to_string();
                let v2 = record["detail"]["version2"].as_str().unwrap_or("").to_string();

                Ok(ConflictResolutionResolveOutput::RequiresHuman {
                    conflict_id: input.conflict_id,
                    options: vec![v1.into_bytes(), v2.into_bytes()],
                })
            }
        }
    }

    async fn manual_resolve(
        &self,
        input: ConflictResolutionManualResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionManualResolveOutput, Box<dyn std::error::Error>> {
        let conflict_key = input.conflict_id.as_str().unwrap_or("");
        let conflict = storage.get("conflict", conflict_key).await?;

        let record = match conflict {
            Some(r) => r,
            None => {
                return Ok(ConflictResolutionManualResolveOutput::NotPending {
                    message: "Conflict not found".to_string(),
                });
            }
        };

        let status = record["status"].as_str().unwrap_or("");
        if status == "resolved" {
            return Ok(ConflictResolutionManualResolveOutput::NotPending {
                message: "Conflict already resolved".to_string(),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("resolved");
        updated["resolvedBy"] = json!("manual");
        updated["chosenValue"] = json!(input.chosen);
        storage.put("conflict", conflict_key, updated).await?;

        Ok(ConflictResolutionManualResolveOutput::Ok {
            result: input.chosen,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_policy_success() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.register_policy(
            ConflictResolutionRegisterPolicyInput {
                name: "lww".to_string(),
                priority: 10,
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionRegisterPolicyOutput::Ok { policy } => {
                assert_eq!(policy["name"], "lww");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_policy_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;

        handler.register_policy(
            ConflictResolutionRegisterPolicyInput { name: "lww".to_string(), priority: 10 },
            &storage,
        ).await.unwrap();

        let result = handler.register_policy(
            ConflictResolutionRegisterPolicyInput { name: "lww".to_string(), priority: 10 },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionRegisterPolicyOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_no_conflict_same_versions() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.detect(
            ConflictResolutionDetectInput {
                base: None,
                version1: "v1".to_string(),
                version2: "v1".to_string(),
                context: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionDetectOutput::NoConflict => {},
            _ => panic!("Expected NoConflict variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_conflict() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.detect(
            ConflictResolutionDetectInput {
                base: Some("base".to_string()),
                version1: "v1".to_string(),
                version2: "v2".to_string(),
                context: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionDetectOutput::Detected { conflict_id, .. } => {
                assert!(conflict_id.as_str().unwrap().contains("conflict"));
            },
            _ => panic!("Expected Detected variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_no_conflict_one_side_matches_base() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.detect(
            ConflictResolutionDetectInput {
                base: Some("base".to_string()),
                version1: "base".to_string(),
                version2: "v2".to_string(),
                context: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionDetectOutput::NoConflict => {},
            _ => panic!("Expected NoConflict variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_no_policy() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.resolve(
            ConflictResolutionResolveInput {
                conflict_id: json!("nonexistent"),
                policy_override: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionResolveOutput::NoPolicy { .. } => {},
            _ => panic!("Expected NoPolicy variant"),
        }
    }

    #[tokio::test]
    async fn test_manual_resolve_not_pending() {
        let storage = InMemoryStorage::new();
        let handler = ConflictResolutionHandlerImpl;
        let result = handler.manual_resolve(
            ConflictResolutionManualResolveInput {
                conflict_id: json!("nonexistent"),
                chosen: "value".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConflictResolutionManualResolveOutput::NotPending { .. } => {},
            _ => panic!("Expected NotPending variant"),
        }
    }
}
