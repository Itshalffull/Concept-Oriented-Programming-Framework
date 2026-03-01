// generated: navigator/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NavigatorHandler: Send + Sync {
    async fn register(
        &self,
        input: NavigatorRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorRegisterOutput, Box<dyn std::error::Error>>;

    async fn go(
        &self,
        input: NavigatorGoInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorGoOutput, Box<dyn std::error::Error>>;

    async fn back(
        &self,
        input: NavigatorBackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorBackOutput, Box<dyn std::error::Error>>;

    async fn forward(
        &self,
        input: NavigatorForwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorForwardOutput, Box<dyn std::error::Error>>;

    async fn replace(
        &self,
        input: NavigatorReplaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorReplaceOutput, Box<dyn std::error::Error>>;

    async fn add_guard(
        &self,
        input: NavigatorAddGuardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorAddGuardOutput, Box<dyn std::error::Error>>;

    async fn remove_guard(
        &self,
        input: NavigatorRemoveGuardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NavigatorRemoveGuardOutput, Box<dyn std::error::Error>>;

}
