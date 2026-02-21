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
        input: ValidatorValidateInput,
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
