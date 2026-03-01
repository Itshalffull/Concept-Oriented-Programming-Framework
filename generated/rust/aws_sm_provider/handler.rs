// generated: aws_sm_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AwsSmProviderHandler: Send + Sync {
    async fn fetch(
        &self,
        input: AwsSmProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AwsSmProviderFetchOutput, Box<dyn std::error::Error>>;

    async fn rotate(
        &self,
        input: AwsSmProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AwsSmProviderRotateOutput, Box<dyn std::error::Error>>;

}
