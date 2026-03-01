// generated: wallet/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WalletHandler: Send + Sync {
    async fn verify(
        &self,
        input: WalletVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletVerifyOutput, Box<dyn std::error::Error>>;

    async fn verify_typed_data(
        &self,
        input: WalletVerifyTypedDataInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletVerifyTypedDataOutput, Box<dyn std::error::Error>>;

    async fn get_nonce(
        &self,
        input: WalletGetNonceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletGetNonceOutput, Box<dyn std::error::Error>>;

    async fn increment_nonce(
        &self,
        input: WalletIncrementNonceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WalletIncrementNonceOutput, Box<dyn std::error::Error>>;

}
