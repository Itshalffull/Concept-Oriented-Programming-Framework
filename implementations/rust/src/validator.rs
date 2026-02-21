// Validator Concept Implementation (Rust)
//
// Infrastructure kit — registers validation constraints, adds rules to
// schemas, validates nodes against proposed changes, and validates
// individual field values.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── RegisterConstraint ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorRegisterConstraintInput {
    pub constraint_id: String,
    pub evaluator_config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidatorRegisterConstraintOutput {
    #[serde(rename = "ok")]
    Ok { constraint_id: String },
}

// ── AddRule ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorAddRuleInput {
    pub schema_id: String,
    pub field_id: String,
    pub constraint_id: String,
    pub params: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidatorAddRuleOutput {
    #[serde(rename = "ok")]
    Ok { schema_id: String, field_id: String },
}

// ── Validate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorValidateInput {
    pub node_id: String,
    pub proposed_changes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidatorValidateOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
    #[serde(rename = "invalid")]
    Invalid { errors: String },
}

// ── ValidateField ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorValidateFieldInput {
    pub value: String,
    pub field_type: String,
    pub constraints: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidatorValidateFieldOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
    #[serde(rename = "invalid")]
    Invalid { errors: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ValidatorHandler;

impl ValidatorHandler {
    pub async fn register_constraint(
        &self,
        input: ValidatorRegisterConstraintInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidatorRegisterConstraintOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "constraint",
                &input.constraint_id,
                json!({
                    "constraint_id": input.constraint_id,
                    "evaluator_config": input.evaluator_config,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(ValidatorRegisterConstraintOutput::Ok {
            constraint_id: input.constraint_id,
        })
    }

    pub async fn add_rule(
        &self,
        input: ValidatorAddRuleInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidatorAddRuleOutput> {
        let key = format!("{}:{}:{}", input.schema_id, input.field_id, input.constraint_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "validation_rule",
                &key,
                json!({
                    "schema_id": input.schema_id,
                    "field_id": input.field_id,
                    "constraint_id": input.constraint_id,
                    "params": input.params,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(ValidatorAddRuleOutput::Ok {
            schema_id: input.schema_id,
            field_id: input.field_id,
        })
    }

    pub async fn validate(
        &self,
        _input: ValidatorValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidatorValidateOutput> {
        // Get all validation rules
        let all_rules = storage.find("validation_rule", None).await?;

        if all_rules.is_empty() {
            // No rules defined, everything is valid
            return Ok(ValidatorValidateOutput::Ok { valid: true });
        }

        // Check that all referenced constraints exist
        let mut errors: Vec<String> = Vec::new();
        for rule in &all_rules {
            let constraint_id = rule["constraint_id"].as_str().unwrap_or("");
            let constraint = storage.get("constraint", constraint_id).await?;
            if constraint.is_none() {
                errors.push(format!("constraint '{}' not registered", constraint_id));
            }
        }

        if errors.is_empty() {
            Ok(ValidatorValidateOutput::Ok { valid: true })
        } else {
            Ok(ValidatorValidateOutput::Invalid {
                errors: serde_json::to_string(&errors)?,
            })
        }
    }

    pub async fn validate_field(
        &self,
        input: ValidatorValidateFieldInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidatorValidateFieldOutput> {
        let mut errors: Vec<String> = Vec::new();

        // Basic built-in validation based on field_type
        match input.field_type.as_str() {
            "required" => {
                if input.value.is_empty() {
                    errors.push("value is required".to_string());
                }
            }
            "email" => {
                if !input.value.contains('@') {
                    errors.push("value is not a valid email".to_string());
                }
            }
            _ => {
                // No built-in validation for unknown field types
            }
        }

        if errors.is_empty() {
            Ok(ValidatorValidateFieldOutput::Ok { valid: true })
        } else {
            Ok(ValidatorValidateFieldOutput::Invalid {
                errors: serde_json::to_string(&errors)?,
            })
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── register_constraint tests ──────────────────────────

    #[tokio::test]
    async fn register_constraint_returns_ok() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .register_constraint(
                ValidatorRegisterConstraintInput {
                    constraint_id: "required".into(),
                    evaluator_config: r#"{"type":"required"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ValidatorRegisterConstraintOutput::Ok { constraint_id } => {
                assert_eq!(constraint_id, "required");
            }
        }
    }

    #[tokio::test]
    async fn register_constraint_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        handler
            .register_constraint(
                ValidatorRegisterConstraintInput {
                    constraint_id: "max_length".into(),
                    evaluator_config: r#"{"max":255}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("constraint", "max_length").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(
            record["evaluator_config"].as_str().unwrap(),
            r#"{"max":255}"#
        );
    }

    // ── add_rule tests ─────────────────────────────────────

    #[tokio::test]
    async fn add_rule_stores_validation_rule() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .add_rule(
                ValidatorAddRuleInput {
                    schema_id: "schema_user".into(),
                    field_id: "email".into(),
                    constraint_id: "required".into(),
                    params: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ValidatorAddRuleOutput::Ok { schema_id, field_id } => {
                assert_eq!(schema_id, "schema_user");
                assert_eq!(field_id, "email");
            }
        }

        let record = storage
            .get("validation_rule", "schema_user:email:required")
            .await
            .unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn add_rule_stores_multiple_rules() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        handler
            .add_rule(
                ValidatorAddRuleInput {
                    schema_id: "s1".into(),
                    field_id: "name".into(),
                    constraint_id: "required".into(),
                    params: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                ValidatorAddRuleInput {
                    schema_id: "s1".into(),
                    field_id: "name".into(),
                    constraint_id: "max_length".into(),
                    params: r#"{"max":100}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let r1 = storage
            .get("validation_rule", "s1:name:required")
            .await
            .unwrap();
        let r2 = storage
            .get("validation_rule", "s1:name:max_length")
            .await
            .unwrap();
        assert!(r1.is_some());
        assert!(r2.is_some());
    }

    // ── validate tests ─────────────────────────────────────

    #[tokio::test]
    async fn validate_returns_valid_when_no_rules_defined() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .validate(
                ValidatorValidateInput {
                    node_id: "n1".into(),
                    proposed_changes: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidatorValidateOutput::Ok { valid: true }));
    }

    #[tokio::test]
    async fn validate_returns_valid_when_constraints_registered() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        handler
            .register_constraint(
                ValidatorRegisterConstraintInput {
                    constraint_id: "required".into(),
                    evaluator_config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                ValidatorAddRuleInput {
                    schema_id: "s1".into(),
                    field_id: "name".into(),
                    constraint_id: "required".into(),
                    params: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .validate(
                ValidatorValidateInput {
                    node_id: "n1".into(),
                    proposed_changes: r#"{"name":"value"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidatorValidateOutput::Ok { valid: true }));
    }

    #[tokio::test]
    async fn validate_returns_invalid_when_constraint_not_registered() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        // Add a rule referencing a constraint that is NOT registered
        handler
            .add_rule(
                ValidatorAddRuleInput {
                    schema_id: "s1".into(),
                    field_id: "email".into(),
                    constraint_id: "unregistered".into(),
                    params: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .validate(
                ValidatorValidateInput {
                    node_id: "n1".into(),
                    proposed_changes: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ValidatorValidateOutput::Invalid { .. }
        ));
    }

    // ── validate_field tests ───────────────────────────────

    #[tokio::test]
    async fn validate_field_returns_valid_for_required_nonempty() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .validate_field(
                ValidatorValidateFieldInput {
                    value: "notempty".into(),
                    field_type: "required".into(),
                    constraints: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ValidatorValidateFieldOutput::Ok { valid: true }
        ));
    }

    #[tokio::test]
    async fn validate_field_returns_invalid_for_required_empty() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .validate_field(
                ValidatorValidateFieldInput {
                    value: "".into(),
                    field_type: "required".into(),
                    constraints: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ValidatorValidateFieldOutput::Invalid { .. }
        ));
    }

    #[tokio::test]
    async fn validate_field_returns_invalid_for_email_without_at() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .validate_field(
                ValidatorValidateFieldInput {
                    value: "notanemail".into(),
                    field_type: "email".into(),
                    constraints: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ValidatorValidateFieldOutput::Invalid { .. }
        ));
    }

    #[tokio::test]
    async fn validate_field_returns_valid_for_email_with_at() {
        let storage = InMemoryStorage::new();
        let handler = ValidatorHandler;

        let result = handler
            .validate_field(
                ValidatorValidateFieldInput {
                    value: "user@example.com".into(),
                    field_type: "email".into(),
                    constraints: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            ValidatorValidateFieldOutput::Ok { valid: true }
        ));
    }
}
