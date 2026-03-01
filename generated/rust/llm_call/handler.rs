// generated: llm_call/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LLMCallHandler: Send + Sync {
    async fn request(
        &self,
        input: LLMCallRequestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRequestOutput, Box<dyn std::error::Error>>;

    async fn record_response(
        &self,
        input: LLMCallRecordResponseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRecordResponseOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: LLMCallValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallValidateOutput, Box<dyn std::error::Error>>;

    async fn repair(
        &self,
        input: LLMCallRepairInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRepairOutput, Box<dyn std::error::Error>>;

    async fn accept(
        &self,
        input: LLMCallAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallAcceptOutput, Box<dyn std::error::Error>>;

    async fn reject(
        &self,
        input: LLMCallRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRejectOutput, Box<dyn std::error::Error>>;
}
