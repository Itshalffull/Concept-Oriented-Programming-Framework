// generated: grpc_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GrpcTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: GrpcTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: GrpcTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_rpcs(
        &self,
        input: GrpcTargetListRpcsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GrpcTargetListRpcsOutput, Box<dyn std::error::Error>>;

}
