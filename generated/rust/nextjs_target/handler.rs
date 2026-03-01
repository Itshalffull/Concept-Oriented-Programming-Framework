// generated: nextjs_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NextjsTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: NextjsTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: NextjsTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_routes(
        &self,
        input: NextjsTargetListRoutesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsTargetListRoutesOutput, Box<dyn std::error::Error>>;

}
