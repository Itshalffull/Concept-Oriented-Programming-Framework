// Intent -- defines and verifies operational intents for concepts.
// Intents capture the purpose and operational principle behind a concept action,
// enabling discovery and verification of behavioral contracts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::IntentHandler;
use serde_json::json;

pub struct IntentHandlerImpl;

#[async_trait]
impl IntentHandler for IntentHandlerImpl {
    async fn define(
        &self,
        input: IntentDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("intent", &input.intent).await?;
        if existing.is_some() {
            return Ok(IntentDefineOutput::Exists {
                message: format!("Intent '{}' already exists", input.intent),
            });
        }

        storage.put("intent", &input.intent, json!({
            "intent": input.intent,
            "target": input.target,
            "purpose": input.purpose,
            "operationalPrinciple": input.operational_principle,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(IntentDefineOutput::Ok {
            intent: input.intent,
        })
    }

    async fn update(
        &self,
        input: IntentUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("intent", &input.intent).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(IntentUpdateOutput::Notfound {
                    message: format!("Intent '{}' not found", input.intent),
                });
            }
        };

        let mut updated = record.clone();
        updated["purpose"] = json!(input.purpose);
        updated["operationalPrinciple"] = json!(input.operational_principle);
        storage.put("intent", &input.intent, updated).await?;

        Ok(IntentUpdateOutput::Ok {
            intent: input.intent,
        })
    }

    async fn verify(
        &self,
        input: IntentVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentVerifyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("intent", &input.intent).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(IntentVerifyOutput::Notfound {
                    message: format!("Intent '{}' not found", input.intent),
                });
            }
        };

        let mut failures = Vec::new();

        // Verify that purpose is non-empty
        let purpose = record.get("purpose").and_then(|v| v.as_str()).unwrap_or("");
        if purpose.is_empty() {
            failures.push("Missing purpose".to_string());
        }

        // Verify that operational principle is non-empty
        let op = record.get("operationalPrinciple").and_then(|v| v.as_str()).unwrap_or("");
        if op.is_empty() {
            failures.push("Missing operational principle".to_string());
        }

        // Verify that target is defined
        let target = record.get("target").and_then(|v| v.as_str()).unwrap_or("");
        if target.is_empty() {
            failures.push("Missing target concept".to_string());
        }

        let valid = failures.is_empty();

        Ok(IntentVerifyOutput::Ok {
            valid,
            failures: serde_json::to_string(&failures)?,
        })
    }

    async fn discover(
        &self,
        input: IntentDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentDiscoverOutput, Box<dyn std::error::Error>> {
        let all_intents = storage.find("intent", None).await?;

        let query_lower = input.query.to_lowercase();
        let matches: Vec<serde_json::Value> = all_intents.into_iter()
            .filter(|intent| {
                let purpose = intent.get("purpose").and_then(|v| v.as_str()).unwrap_or("");
                let target = intent.get("target").and_then(|v| v.as_str()).unwrap_or("");
                let op = intent.get("operationalPrinciple").and_then(|v| v.as_str()).unwrap_or("");
                let name = intent.get("intent").and_then(|v| v.as_str()).unwrap_or("");

                purpose.to_lowercase().contains(&query_lower)
                    || target.to_lowercase().contains(&query_lower)
                    || op.to_lowercase().contains(&query_lower)
                    || name.to_lowercase().contains(&query_lower)
            })
            .map(|intent| {
                json!({
                    "intent": intent.get("intent").and_then(|v| v.as_str()).unwrap_or(""),
                    "target": intent.get("target").and_then(|v| v.as_str()).unwrap_or(""),
                    "purpose": intent.get("purpose").and_then(|v| v.as_str()).unwrap_or(""),
                })
            })
            .collect();

        Ok(IntentDiscoverOutput::Ok {
            matches: serde_json::to_string(&matches)?,
        })
    }

    async fn suggest_from_description(
        &self,
        input: IntentSuggestFromDescriptionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentSuggestFromDescriptionOutput, Box<dyn std::error::Error>> {
        let description_lower = input.description.to_lowercase();

        // Extract key verbs and nouns to suggest an intent structure
        let verbs = ["create", "read", "update", "delete", "list", "search",
                     "validate", "transform", "notify", "sync", "publish"];

        let detected_verb = verbs.iter()
            .find(|v| description_lower.contains(**v))
            .copied()
            .unwrap_or("manage");

        // Extract likely target from description (first capitalized word after common prepositions)
        let words: Vec<&str> = input.description.split_whitespace().collect();
        let target = words.iter()
            .find(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false))
            .copied()
            .unwrap_or("Entity");

        let suggested = json!({
            "intent": format!("{}-{}", detected_verb, target.to_lowercase()),
            "target": target,
            "purpose": input.description,
            "operationalPrinciple": format!("When {} is invoked, the system shall {} the {}",
                detected_verb, detected_verb, target.to_lowercase()),
        });

        Ok(IntentSuggestFromDescriptionOutput::Ok {
            suggested: serde_json::to_string(&suggested)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_success() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        let result = handler.define(
            IntentDefineInput {
                intent: "create-user".to_string(),
                target: "user".to_string(),
                purpose: "Register a new user account".to_string(),
                operational_principle: "When invoked, creates a persistent user record".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IntentDefineOutput::Ok { intent } => {
                assert_eq!(intent, "create-user");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        handler.define(
            IntentDefineInput {
                intent: "create-user".to_string(),
                target: "user".to_string(),
                purpose: "Register a new user".to_string(),
                operational_principle: "Creates user record".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            IntentDefineInput {
                intent: "create-user".to_string(),
                target: "user".to_string(),
                purpose: "Duplicate".to_string(),
                operational_principle: "Duplicate".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IntentDefineOutput::Exists { message } => {
                assert!(message.contains("already exists"));
            },
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_update_success() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        handler.define(
            IntentDefineInput {
                intent: "update-profile".to_string(),
                target: "profile".to_string(),
                purpose: "Update profile fields".to_string(),
                operational_principle: "Modifies profile record".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.update(
            IntentUpdateInput {
                intent: "update-profile".to_string(),
                purpose: "Updated purpose".to_string(),
                operational_principle: "Updated principle".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IntentUpdateOutput::Ok { intent } => {
                assert_eq!(intent, "update-profile");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_update_notfound() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        let result = handler.update(
            IntentUpdateInput {
                intent: "missing".to_string(),
                purpose: "x".to_string(),
                operational_principle: "y".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IntentUpdateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_valid() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        handler.define(
            IntentDefineInput {
                intent: "verify-me".to_string(),
                target: "entity".to_string(),
                purpose: "Test purpose".to_string(),
                operational_principle: "Test principle".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.verify(
            IntentVerifyInput { intent: "verify-me".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            IntentVerifyOutput::Ok { valid, .. } => {
                assert!(valid);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_notfound() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        let result = handler.verify(
            IntentVerifyInput { intent: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            IntentVerifyOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_discover_empty() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        let result = handler.discover(
            IntentDiscoverInput { query: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            IntentDiscoverOutput::Ok { matches } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&matches).unwrap();
                assert!(parsed.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_suggest_from_description() {
        let storage = InMemoryStorage::new();
        let handler = IntentHandlerImpl;
        let result = handler.suggest_from_description(
            IntentSuggestFromDescriptionInput {
                description: "Create a new User account for registration".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IntentSuggestFromDescriptionOutput::Ok { suggested } => {
                assert!(!suggested.is_empty());
                let parsed: serde_json::Value = serde_json::from_str(&suggested).unwrap();
                assert!(parsed.get("intent").is_some());
            },
        }
    }
}
