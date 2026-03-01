// generated: contract_test/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContractTestHandler: Send + Sync {
    async fn generate(
        &self,
        input: ContractTestGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractTestGenerateOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: ContractTestVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractTestVerifyOutput, Box<dyn std::error::Error>>;

    async fn matrix(
        &self,
        input: ContractTestMatrixInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractTestMatrixOutput, Box<dyn std::error::Error>>;

    async fn can_deploy(
        &self,
        input: ContractTestCanDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContractTestCanDeployOutput, Box<dyn std::error::Error>>;

}
