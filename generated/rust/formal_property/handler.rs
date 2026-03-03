// generated: formal_property/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FormalPropertyHandler: Send + Sync {
    async fn define(
        &self,
        input: FormalPropertyDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyDefineOutput, Box<dyn std::error::Error>>;

    async fn prove(
        &self,
        input: FormalPropertyProveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyProveOutput, Box<dyn std::error::Error>>;

    async fn refute(
        &self,
        input: FormalPropertyRefuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyRefuteOutput, Box<dyn std::error::Error>>;

    async fn check(
        &self,
        input: FormalPropertyCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyCheckOutput, Box<dyn std::error::Error>>;

    async fn synthesize(
        &self,
        input: FormalPropertySynthesizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertySynthesizeOutput, Box<dyn std::error::Error>>;

    async fn coverage(
        &self,
        input: FormalPropertyCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyCoverageOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: FormalPropertyListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyListOutput, Box<dyn std::error::Error>>;

    async fn invalidate(
        &self,
        input: FormalPropertyInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormalPropertyInvalidateOutput, Box<dyn std::error::Error>>;

}