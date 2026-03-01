// generated: react_native_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ReactNativeAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: ReactNativeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactNativeAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
