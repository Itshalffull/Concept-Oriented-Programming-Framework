// generated: binding/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BindingHandler: Send + Sync {
    async fn bind(
        &self,
        input: BindingBindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingBindOutput, Box<dyn std::error::Error>>;

    async fn sync(
        &self,
        input: BindingSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingSyncOutput, Box<dyn std::error::Error>>;

    async fn invoke(
        &self,
        input: BindingInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingInvokeOutput, Box<dyn std::error::Error>>;

    async fn unbind(
        &self,
        input: BindingUnbindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingUnbindOutput, Box<dyn std::error::Error>>;

}
