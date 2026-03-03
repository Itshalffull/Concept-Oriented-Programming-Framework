// generated: contract/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContractHandler: Send + Sync {
    async fn define(
        &self,
        input: ContractDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractDefineOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: ContractVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractVerifyOutput, Box<dyn std::error::Error>>;

    async fn compose(
        &self,
        input: ContractComposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractComposeOutput, Box<dyn std::error::Error>>;

    async fn discharge(
        &self,
        input: ContractDischargeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractDischargeOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: ContractListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractListOutput, Box<dyn std::error::Error>>;

}