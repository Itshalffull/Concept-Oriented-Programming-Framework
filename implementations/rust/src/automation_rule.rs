// AutomationRule Concept Implementation (Rust)
//
// Automation kit — defines automation rules with triggers, conditions,
// and actions; enables/disables rules; evaluates events against rules.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Define ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRuleDefineInput {
    pub trigger: String,
    pub conditions: String,
    pub actions: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AutomationRuleDefineOutput {
    #[serde(rename = "ok")]
    Ok { rule_id: String },
}

// ── Enable ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRuleEnableInput {
    pub rule_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AutomationRuleEnableOutput {
    #[serde(rename = "ok")]
    Ok { rule_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Disable ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRuleDisableInput {
    pub rule_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AutomationRuleDisableOutput {
    #[serde(rename = "ok")]
    Ok { rule_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Evaluate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRuleEvaluateInput {
    pub rule_id: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AutomationRuleEvaluateOutput {
    #[serde(rename = "ok")]
    Ok { rule_id: String, matched: bool },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct AutomationRuleHandler;

impl AutomationRuleHandler {
    pub async fn define(
        &self,
        input: AutomationRuleDefineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AutomationRuleDefineOutput> {
        let rule_id = format!("rule_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "automation_rule",
                &rule_id,
                json!({
                    "rule_id": rule_id,
                    "trigger": input.trigger,
                    "conditions": input.conditions,
                    "actions": input.actions,
                    "enabled": input.enabled,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(AutomationRuleDefineOutput::Ok { rule_id })
    }

    pub async fn enable(
        &self,
        input: AutomationRuleEnableInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AutomationRuleEnableOutput> {
        let existing = storage.get("automation_rule", &input.rule_id).await?;
        match existing {
            None => Ok(AutomationRuleEnableOutput::NotFound {
                message: format!("rule '{}' not found", input.rule_id),
            }),
            Some(mut record) => {
                record["enabled"] = json!(true);
                storage
                    .put("automation_rule", &input.rule_id, record)
                    .await?;
                Ok(AutomationRuleEnableOutput::Ok {
                    rule_id: input.rule_id,
                })
            }
        }
    }

    pub async fn disable(
        &self,
        input: AutomationRuleDisableInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AutomationRuleDisableOutput> {
        let existing = storage.get("automation_rule", &input.rule_id).await?;
        match existing {
            None => Ok(AutomationRuleDisableOutput::NotFound {
                message: format!("rule '{}' not found", input.rule_id),
            }),
            Some(mut record) => {
                record["enabled"] = json!(false);
                storage
                    .put("automation_rule", &input.rule_id, record)
                    .await?;
                Ok(AutomationRuleDisableOutput::Ok {
                    rule_id: input.rule_id,
                })
            }
        }
    }

    pub async fn evaluate(
        &self,
        input: AutomationRuleEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AutomationRuleEvaluateOutput> {
        let existing = storage.get("automation_rule", &input.rule_id).await?;
        match existing {
            None => Ok(AutomationRuleEvaluateOutput::NotFound {
                message: format!("rule '{}' not found", input.rule_id),
            }),
            Some(record) => {
                let enabled = record["enabled"].as_bool().unwrap_or(false);
                // A rule matches if it is enabled (simplified evaluation)
                let matched = enabled;
                Ok(AutomationRuleEvaluateOutput::Ok {
                    rule_id: input.rule_id,
                    matched,
                })
            }
        }
    }
}
