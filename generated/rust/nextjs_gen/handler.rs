// generated: nextjs_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NextjsGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: NextjsGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsGenGenerateOutput, Box<dyn std::error::Error>>;

}
