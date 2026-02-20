// generated: profile/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProfileHandler: Send + Sync {
    async fn update(
        &self,
        input: ProfileUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProfileUpdateOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ProfileGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProfileGetOutput, Box<dyn std::error::Error>>;

}
