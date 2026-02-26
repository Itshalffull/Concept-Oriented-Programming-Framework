// generated: pathauto/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PathautoHandler: Send + Sync {
    async fn generate_alias(
        &self,
        input: PathautoGenerateAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PathautoGenerateAliasOutput, Box<dyn std::error::Error>>;

    async fn bulk_generate(
        &self,
        input: PathautoBulkGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PathautoBulkGenerateOutput, Box<dyn std::error::Error>>;

    async fn clean_string(
        &self,
        input: PathautoCleanStringInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PathautoCleanStringOutput, Box<dyn std::error::Error>>;

}
