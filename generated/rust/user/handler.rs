// generated: user/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait UserHandler: Send + Sync {
    async fn register(
        &self,
        input: UserRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UserRegisterOutput, Box<dyn std::error::Error>>;

}
