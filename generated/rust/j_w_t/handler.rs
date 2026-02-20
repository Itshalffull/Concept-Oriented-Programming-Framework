// generated: j_w_t/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait JWTHandler: Send + Sync {
    async fn generate(
        &self,
        input: JWTGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<JWTGenerateOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: JWTVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<JWTVerifyOutput, Box<dyn std::error::Error>>;

}
