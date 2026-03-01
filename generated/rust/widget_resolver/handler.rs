// generated: widget_resolver/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetResolverHandler: Send + Sync {
    async fn resolve(
        &self,
        input: WidgetResolverResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverResolveOutput, Box<dyn std::error::Error>>;

    async fn resolve_all(
        &self,
        input: WidgetResolverResolveAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverResolveAllOutput, Box<dyn std::error::Error>>;

    async fn override(
        &self,
        input: WidgetResolverOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverOverrideOutput, Box<dyn std::error::Error>>;

    async fn set_weights(
        &self,
        input: WidgetResolverSetWeightsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverSetWeightsOutput, Box<dyn std::error::Error>>;

    async fn explain(
        &self,
        input: WidgetResolverExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverExplainOutput, Box<dyn std::error::Error>>;

}
