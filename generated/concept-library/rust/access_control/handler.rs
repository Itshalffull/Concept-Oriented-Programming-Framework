// generated: access_control/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AccessControlHandler: Send + Sync {
    async fn check(
        &self,
        input: AccessControlCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AccessControlCheckOutput, Box<dyn std::error::Error>>;

    async fn or_if(
        &self,
        input: AccessControlOrIfInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AccessControlOrIfOutput, Box<dyn std::error::Error>>;

    async fn and_if(
        &self,
        input: AccessControlAndIfInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AccessControlAndIfOutput, Box<dyn std::error::Error>>;

}
