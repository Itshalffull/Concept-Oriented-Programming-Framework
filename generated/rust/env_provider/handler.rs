// generated: env_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EnvProviderHandler: Send + Sync {
    async fn fetch(
        &self,
        input: EnvProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvProviderFetchOutput, Box<dyn std::error::Error>>;

}
