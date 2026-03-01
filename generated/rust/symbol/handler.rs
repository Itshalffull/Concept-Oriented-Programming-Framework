// generated: symbol/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SymbolHandler: Send + Sync {
    async fn register(
        &self,
        input: SymbolRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRegisterOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: SymbolResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolResolveOutput, Box<dyn std::error::Error>>;

    async fn find_by_kind(
        &self,
        input: SymbolFindByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolFindByKindOutput, Box<dyn std::error::Error>>;

    async fn find_by_file(
        &self,
        input: SymbolFindByFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolFindByFileOutput, Box<dyn std::error::Error>>;

    async fn rename(
        &self,
        input: SymbolRenameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolRenameOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: SymbolGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SymbolGetOutput, Box<dyn std::error::Error>>;

}
