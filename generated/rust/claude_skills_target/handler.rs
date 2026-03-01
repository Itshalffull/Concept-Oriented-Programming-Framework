// generated: claude_skills_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ClaudeSkillsTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: ClaudeSkillsTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: ClaudeSkillsTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_skills(
        &self,
        input: ClaudeSkillsTargetListSkillsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetListSkillsOutput, Box<dyn std::error::Error>>;

}
