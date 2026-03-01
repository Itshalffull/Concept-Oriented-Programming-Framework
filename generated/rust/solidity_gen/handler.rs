// generated: solidity_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SolidityGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: SolidityGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SolidityGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityGenRegisterOutput, Box<dyn std::error::Error>>;

}
