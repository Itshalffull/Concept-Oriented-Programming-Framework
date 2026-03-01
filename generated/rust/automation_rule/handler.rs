// generated: automation_rule/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AutomationRuleHandler: Send + Sync {
    async fn define(
        &self,
        input: AutomationRuleDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleDefineOutput, Box<dyn std::error::Error>>;

    async fn enable(
        &self,
        input: AutomationRuleEnableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleEnableOutput, Box<dyn std::error::Error>>;

    async fn disable(
        &self,
        input: AutomationRuleDisableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleDisableOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: AutomationRuleExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AutomationRuleExecuteOutput, Box<dyn std::error::Error>>;

}
