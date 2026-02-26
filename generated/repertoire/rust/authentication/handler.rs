// generated: authentication/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AuthenticationHandler: Send + Sync {
    async fn register(
        &self,
        input: AuthenticationRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationRegisterOutput, Box<dyn std::error::Error>>;

    async fn login(
        &self,
        input: AuthenticationLoginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationLoginOutput, Box<dyn std::error::Error>>;

    async fn logout(
        &self,
        input: AuthenticationLogoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationLogoutOutput, Box<dyn std::error::Error>>;

    async fn authenticate(
        &self,
        input: AuthenticationAuthenticateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationAuthenticateOutput, Box<dyn std::error::Error>>;

    async fn reset_password(
        &self,
        input: AuthenticationResetPasswordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationResetPasswordOutput, Box<dyn std::error::Error>>;

}
