// Formula Concept Implementation (Rust)
//
// Computation kit — evaluates formulas, tracks dependencies,
// invalidates cached results, and sets expressions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Evaluate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormulaEvaluateInput {
    pub formula_id: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FormulaEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { formula_id: String, result: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetDependencies ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormulaGetDependenciesInput {
    pub formula_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FormulaGetDependenciesOutput {
    #[serde(rename = "ok")]
    Ok {
        formula_id: String,
        dependencies: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Invalidate ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormulaInvalidateInput {
    pub formula_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FormulaInvalidateOutput {
    #[serde(rename = "ok")]
    Ok { formula_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── SetExpression ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormulaSetExpressionInput {
    pub formula_id: String,
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FormulaSetExpressionOutput {
    #[serde(rename = "ok")]
    Ok { formula_id: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct FormulaHandler;

impl FormulaHandler {
    pub async fn evaluate(
        &self,
        input: FormulaEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FormulaEvaluateOutput> {
        let existing = storage.get("formula", &input.formula_id).await?;
        match existing {
            None => Ok(FormulaEvaluateOutput::NotFound {
                message: format!("formula '{}' not found", input.formula_id),
            }),
            Some(record) => {
                let expression = record["expression"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                // Store cached result with context
                let now = chrono::Utc::now().to_rfc3339();
                let result = json!({
                    "expression": expression,
                    "context": input.context,
                    "evaluated_at": now,
                })
                .to_string();

                let mut updated = record.clone();
                updated["cached_result"] = json!(result);
                updated["evaluated_at"] = json!(now);
                storage
                    .put("formula", &input.formula_id, updated)
                    .await?;

                Ok(FormulaEvaluateOutput::Ok {
                    formula_id: input.formula_id,
                    result,
                })
            }
        }
    }

    pub async fn get_dependencies(
        &self,
        input: FormulaGetDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FormulaGetDependenciesOutput> {
        let existing = storage.get("formula", &input.formula_id).await?;
        match existing {
            None => Ok(FormulaGetDependenciesOutput::NotFound {
                message: format!("formula '{}' not found", input.formula_id),
            }),
            Some(record) => {
                let dependencies = record["dependencies"]
                    .as_str()
                    .unwrap_or("[]")
                    .to_string();
                Ok(FormulaGetDependenciesOutput::Ok {
                    formula_id: input.formula_id,
                    dependencies,
                })
            }
        }
    }

    pub async fn invalidate(
        &self,
        input: FormulaInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FormulaInvalidateOutput> {
        let existing = storage.get("formula", &input.formula_id).await?;
        match existing {
            None => Ok(FormulaInvalidateOutput::NotFound {
                message: format!("formula '{}' not found", input.formula_id),
            }),
            Some(mut record) => {
                record["cached_result"] = serde_json::Value::Null;
                record["evaluated_at"] = serde_json::Value::Null;
                storage
                    .put("formula", &input.formula_id, record)
                    .await?;
                Ok(FormulaInvalidateOutput::Ok {
                    formula_id: input.formula_id,
                })
            }
        }
    }

    pub async fn set_expression(
        &self,
        input: FormulaSetExpressionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FormulaSetExpressionOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        let existing = storage.get("formula", &input.formula_id).await?;
        let record = match existing {
            Some(mut r) => {
                r["expression"] = json!(input.expression);
                r["updated_at"] = json!(now);
                r["cached_result"] = serde_json::Value::Null;
                r
            }
            None => {
                json!({
                    "formula_id": input.formula_id,
                    "expression": input.expression,
                    "dependencies": "[]",
                    "cached_result": null,
                    "created_at": now,
                    "updated_at": now,
                })
            }
        };
        storage
            .put("formula", &input.formula_id, record)
            .await?;
        Ok(FormulaSetExpressionOutput::Ok {
            formula_id: input.formula_id,
        })
    }
}
