// generated: native_script_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NativeScriptAdapterHandler: Send + Sync {
    async fn normalize(
        &self,
        input: NativeScriptAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NativeScriptAdapterNormalizeOutput, Box<dyn std::error::Error>>;

}
