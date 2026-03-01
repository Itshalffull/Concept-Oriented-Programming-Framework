// Affordance concept implementation
// Maps interactor types to concrete widgets based on specificity and contextual conditions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AffordanceHandler;
use serde_json::json;

pub struct AffordanceHandlerImpl;

#[async_trait]
impl AffordanceHandler for AffordanceHandlerImpl {
    async fn declare(
        &self,
        input: AffordanceDeclareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceDeclareOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("affordance", &input.affordance).await?;
        if existing.is_some() {
            return Ok(AffordanceDeclareOutput::Duplicate {
                message: "An affordance with this identity already exists".to_string(),
            });
        }

        let conditions_str = input.conditions.as_deref().unwrap_or("{}");
        let parsed_conditions: serde_json::Value = serde_json::from_str(conditions_str).unwrap_or(json!({}));

        let normalized_conditions = json!({
            "minOptions": parsed_conditions.get("minOptions").cloned().unwrap_or(serde_json::Value::Null),
            "maxOptions": parsed_conditions.get("maxOptions").cloned().unwrap_or(serde_json::Value::Null),
            "platform": parsed_conditions.get("platform").cloned().unwrap_or(serde_json::Value::Null),
            "viewport": parsed_conditions.get("viewport").cloned().unwrap_or(serde_json::Value::Null),
            "density": parsed_conditions.get("density").cloned().unwrap_or(serde_json::Value::Null),
            "mutable": parsed_conditions.get("mutable").cloned().unwrap_or(serde_json::Value::Null),
        });

        let now = chrono::Utc::now().to_rfc3339();

        storage.put("affordance", &input.affordance, json!({
            "affordance": input.affordance,
            "widget": input.widget,
            "interactor": input.interactor,
            "specificity": input.specificity,
            "conditions": serde_json::to_string(&normalized_conditions)?,
            "createdAt": now,
        })).await?;

        Ok(AffordanceDeclareOutput::Ok {
            affordance: input.affordance,
        })
    }

    async fn r#match(
        &self,
        input: AffordanceMatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceMatchOutput, Box<dyn std::error::Error>> {
        let parsed_context: serde_json::Value = serde_json::from_str(&input.context).unwrap_or(json!({}));
        let all_affordances = storage.find("affordance", Some(&json!(input.interactor))).await?;

        let mut matching: Vec<serde_json::Value> = Vec::new();

        for aff in &all_affordances {
            if aff["interactor"].as_str() != Some(&input.interactor) {
                continue;
            }

            let conditions: serde_json::Value = serde_json::from_str(
                aff["conditions"].as_str().unwrap_or("{}")
            ).unwrap_or(json!({}));

            // Evaluate each condition against the context
            let mut matches = true;

            if let (Some(cond_platform), Some(ctx_platform)) = (conditions["platform"].as_str(), parsed_context["platform"].as_str()) {
                if cond_platform != ctx_platform { matches = false; }
            }
            if let (Some(cond_viewport), Some(ctx_viewport)) = (conditions["viewport"].as_str(), parsed_context["viewport"].as_str()) {
                if cond_viewport != ctx_viewport { matches = false; }
            }
            if let (Some(cond_density), Some(ctx_density)) = (conditions["density"].as_str(), parsed_context["density"].as_str()) {
                if cond_density != ctx_density { matches = false; }
            }
            if !conditions["mutable"].is_null() && !parsed_context["mutable"].is_null() {
                if conditions["mutable"] != parsed_context["mutable"] { matches = false; }
            }
            if let (Some(min_opts), Some(opt_count)) = (conditions["minOptions"].as_i64(), parsed_context["optionCount"].as_i64()) {
                if opt_count < min_opts { matches = false; }
            }
            if let (Some(max_opts), Some(opt_count)) = (conditions["maxOptions"].as_i64(), parsed_context["optionCount"].as_i64()) {
                if opt_count > max_opts { matches = false; }
            }

            if matches {
                matching.push(aff.clone());
            }
        }

        if matching.is_empty() {
            return Ok(AffordanceMatchOutput::None {
                message: "No affordances match the given interactor and context".to_string(),
            });
        }

        // Sort by specificity descending
        matching.sort_by(|a, b| {
            let sa = a["specificity"].as_i64().unwrap_or(0);
            let sb = b["specificity"].as_i64().unwrap_or(0);
            sb.cmp(&sa)
        });

        let result: Vec<serde_json::Value> = matching.iter().map(|aff| {
            json!({
                "affordance": aff["affordance"],
                "widget": aff["widget"],
                "specificity": aff["specificity"],
            })
        }).collect();

        Ok(AffordanceMatchOutput::Ok {
            matches: serde_json::to_string(&result)?,
        })
    }

    async fn explain(
        &self,
        input: AffordanceExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceExplainOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("affordance", &input.affordance).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AffordanceExplainOutput::Notfound {
                message: "Affordance not found".to_string(),
            }),
        };

        let conditions: serde_json::Value = serde_json::from_str(
            existing["conditions"].as_str().unwrap_or("{}")
        ).unwrap_or(json!({}));

        let mut condition_parts: Vec<String> = Vec::new();
        if let Some(v) = conditions["platform"].as_str() { condition_parts.push(format!("platform={}", v)); }
        if let Some(v) = conditions["viewport"].as_str() { condition_parts.push(format!("viewport={}", v)); }
        if let Some(v) = conditions["density"].as_str() { condition_parts.push(format!("density={}", v)); }
        if !conditions["mutable"].is_null() { condition_parts.push(format!("mutable={}", conditions["mutable"])); }
        if !conditions["minOptions"].is_null() { condition_parts.push(format!("minOptions={}", conditions["minOptions"])); }
        if !conditions["maxOptions"].is_null() { condition_parts.push(format!("maxOptions={}", conditions["maxOptions"])); }

        let condition_str = if condition_parts.is_empty() { "none".to_string() } else { condition_parts.join(", ") };

        let reason = format!(
            "Affordance \"{}\" maps interactor \"{}\" to widget \"{}\" at specificity {} with conditions: {}",
            existing["affordance"].as_str().unwrap_or(""),
            existing["interactor"].as_str().unwrap_or(""),
            existing["widget"].as_str().unwrap_or(""),
            existing["specificity"].as_i64().unwrap_or(0),
            condition_str,
        );

        Ok(AffordanceExplainOutput::Ok {
            affordance: input.affordance,
            reason,
        })
    }

    async fn remove(
        &self,
        input: AffordanceRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceRemoveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("affordance", &input.affordance).await?;
        if existing.is_none() {
            return Ok(AffordanceRemoveOutput::Notfound {
                message: "Affordance not found".to_string(),
            });
        }

        storage.put("affordance", &input.affordance, json!({
            "__deleted": true,
        })).await?;

        Ok(AffordanceRemoveOutput::Ok {
            affordance: input.affordance,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_declare_creates_affordance() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        let result = handler.declare(
            AffordanceDeclareInput {
                affordance: "text-input-aff".to_string(),
                widget: "TextInput".to_string(),
                interactor: "string-field".to_string(),
                specificity: 10,
                conditions: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceDeclareOutput::Ok { affordance } => {
                assert_eq!(affordance, "text-input-aff");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_declare_duplicate_returns_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        handler.declare(
            AffordanceDeclareInput {
                affordance: "dup-aff".to_string(),
                widget: "Widget1".to_string(),
                interactor: "inter1".to_string(),
                specificity: 5,
                conditions: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.declare(
            AffordanceDeclareInput {
                affordance: "dup-aff".to_string(),
                widget: "Widget2".to_string(),
                interactor: "inter2".to_string(),
                specificity: 10,
                conditions: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceDeclareOutput::Duplicate { .. } => {}
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_explain_existing_affordance() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        handler.declare(
            AffordanceDeclareInput {
                affordance: "explain-aff".to_string(),
                widget: "Dropdown".to_string(),
                interactor: "enum-field".to_string(),
                specificity: 20,
                conditions: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.explain(
            AffordanceExplainInput { affordance: "explain-aff".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceExplainOutput::Ok { affordance, reason } => {
                assert_eq!(affordance, "explain-aff");
                assert!(reason.contains("Dropdown"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_explain_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        let result = handler.explain(
            AffordanceExplainInput { affordance: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceExplainOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_existing_affordance() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        handler.declare(
            AffordanceDeclareInput {
                affordance: "remove-aff".to_string(),
                widget: "Checkbox".to_string(),
                interactor: "bool-field".to_string(),
                specificity: 15,
                conditions: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.remove(
            AffordanceRemoveInput { affordance: "remove-aff".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceRemoveOutput::Ok { affordance } => {
                assert_eq!(affordance, "remove-aff");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AffordanceHandlerImpl;
        let result = handler.remove(
            AffordanceRemoveInput { affordance: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AffordanceRemoveOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
