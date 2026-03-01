// generated: language_grammar/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LanguageGrammarHandler: Send + Sync {
    async fn register(
        &self,
        input: LanguageGrammarRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarRegisterOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: LanguageGrammarResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarResolveOutput, Box<dyn std::error::Error>>;

    async fn resolve_by_mime(
        &self,
        input: LanguageGrammarResolveByMimeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarResolveByMimeOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: LanguageGrammarGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarGetOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: LanguageGrammarListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LanguageGrammarListOutput, Box<dyn std::error::Error>>;

}
