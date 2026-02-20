// generated: password/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PasswordHandler: Send + Sync {
    async fn set(
        &self,
        input: PasswordSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordSetOutput, Box<dyn std::error::Error>>;

    async fn check(
        &self,
        input: PasswordCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordCheckOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: PasswordValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordValidateOutput, Box<dyn std::error::Error>>;

}
