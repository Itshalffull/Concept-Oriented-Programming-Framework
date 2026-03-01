// generated: signature/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SignatureHandler: Send + Sync {
    async fn sign(
        &self,
        input: SignatureSignInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureSignOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: SignatureVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureVerifyOutput, Box<dyn std::error::Error>>;

    async fn timestamp(
        &self,
        input: SignatureTimestampInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureTimestampOutput, Box<dyn std::error::Error>>;

    async fn add_trusted_signer(
        &self,
        input: SignatureAddTrustedSignerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SignatureAddTrustedSignerOutput, Box<dyn std::error::Error>>;

}
