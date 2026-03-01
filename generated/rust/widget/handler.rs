// generated: widget/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetHandler: Send + Sync {
    async fn register(
        &self,
        input: WidgetRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetRegisterOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: WidgetGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetGetOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: WidgetListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetListOutput, Box<dyn std::error::Error>>;

    async fn unregister(
        &self,
        input: WidgetUnregisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetUnregisterOutput, Box<dyn std::error::Error>>;

}
