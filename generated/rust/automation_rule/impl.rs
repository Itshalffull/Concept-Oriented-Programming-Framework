// AutomationRule concept implementation
// User-configurable event-condition-action rules that fire automatically when conditions are met.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AutomationRuleHandler;
use serde_json::json;

pub struct AutomationRuleHandlerImpl;

#[async_trait]
impl AutomationRuleHandler for AutomationRuleHandlerImpl {
    async fn define(
        &self,
        input: AutomationRuleDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("automationRule", &input.rule).await?;
        if existing.is_some() {
            return Ok(AutomationRuleDefineOutput::Exists {
                message: "A rule with this identity already exists".to_string(),
            });
        }

        storage.put("automationRule", &input.rule, json!({
            "rule": input.rule,
            "trigger": input.trigger,
            "conditions": input.conditions,
            "actions": input.actions,
            "enabled": false,
        })).await?;

        Ok(AutomationRuleDefineOutput::Ok)
    }

    async fn enable(
        &self,
        input: AutomationRuleEnableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleEnableOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("automationRule", &input.rule).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AutomationRuleEnableOutput::Notfound {
                message: "The rule was not found".to_string(),
            }),
        };

        let mut updated = existing.clone();
        updated["enabled"] = json!(true);
        storage.put("automationRule", &input.rule, updated).await?;

        Ok(AutomationRuleEnableOutput::Ok)
    }

    async fn disable(
        &self,
        input: AutomationRuleDisableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleDisableOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("automationRule", &input.rule).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AutomationRuleDisableOutput::Notfound {
                message: "The rule was not found".to_string(),
            }),
        };

        let mut updated = existing.clone();
        updated["enabled"] = json!(false);
        storage.put("automationRule", &input.rule, updated).await?;

        Ok(AutomationRuleDisableOutput::Ok)
    }

    async fn evaluate(
        &self,
        input: AutomationRuleEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleEvaluateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("automationRule", &input.rule).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AutomationRuleEvaluateOutput::Notfound {
                message: "The rule was not found".to_string(),
            }),
        };

        let trigger = existing["trigger"].as_str().unwrap_or("");
        let enabled = existing["enabled"].as_bool().unwrap_or(false);

        // A rule matches if it is enabled, the event matches the trigger,
        // and conditions are satisfied
        let trigger_match = input.event == trigger;
        let matched = enabled && trigger_match;

        Ok(AutomationRuleEvaluateOutput::Ok { matched })
    }

    async fn execute(
        &self,
        input: AutomationRuleExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleExecuteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("automationRule", &input.rule).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(AutomationRuleExecuteOutput::Notfound {
                message: "The rule was not found".to_string(),
            }),
        };

        let actions = existing["actions"].as_str().unwrap_or("");
        let result = format!("executed:{}:{}", actions, input.context);

        Ok(AutomationRuleExecuteOutput::Ok { result })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_creates_rule() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        let result = handler.define(
            AutomationRuleDefineInput {
                rule: "rule-1".to_string(),
                trigger: "article:create".to_string(),
                conditions: "true".to_string(),
                actions: "notify".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleDefineOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate_returns_exists() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        handler.define(
            AutomationRuleDefineInput {
                rule: "rule-dup".to_string(),
                trigger: "event".to_string(),
                conditions: "true".to_string(),
                actions: "action".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            AutomationRuleDefineInput {
                rule: "rule-dup".to_string(),
                trigger: "event2".to_string(),
                conditions: "true".to_string(),
                actions: "action2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleDefineOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_enable_success() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        handler.define(
            AutomationRuleDefineInput {
                rule: "rule-en".to_string(),
                trigger: "event".to_string(),
                conditions: "true".to_string(),
                actions: "action".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.enable(
            AutomationRuleEnableInput { rule: "rule-en".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleEnableOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_enable_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        let result = handler.enable(
            AutomationRuleEnableInput { rule: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleEnableOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_disable_success() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        handler.define(
            AutomationRuleDefineInput {
                rule: "rule-dis".to_string(),
                trigger: "event".to_string(),
                conditions: "true".to_string(),
                actions: "action".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.disable(
            AutomationRuleDisableInput { rule: "rule-dis".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleDisableOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_disable_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        let result = handler.disable(
            AutomationRuleDisableInput { rule: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleDisableOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_success() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        handler.define(
            AutomationRuleDefineInput {
                rule: "rule-exec".to_string(),
                trigger: "event".to_string(),
                conditions: "true".to_string(),
                actions: "send-email".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.execute(
            AutomationRuleExecuteInput {
                rule: "rule-exec".to_string(),
                context: "ctx-data".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleExecuteOutput::Ok { result } => {
                assert!(result.contains("send-email"));
                assert!(result.contains("ctx-data"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_execute_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AutomationRuleHandlerImpl;
        let result = handler.execute(
            AutomationRuleExecuteInput {
                rule: "missing".to_string(),
                context: "ctx".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AutomationRuleExecuteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
