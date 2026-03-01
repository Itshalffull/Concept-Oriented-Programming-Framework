// generated: score_index/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ScoreIndexHandler: Send + Sync {
    async fn upsert_concept(
        &self,
        input: ScoreIndexUpsertConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertConceptOutput, Box<dyn std::error::Error>>;

    async fn upsert_sync(
        &self,
        input: ScoreIndexUpsertSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertSyncOutput, Box<dyn std::error::Error>>;

    async fn upsert_symbol(
        &self,
        input: ScoreIndexUpsertSymbolInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertSymbolOutput, Box<dyn std::error::Error>>;

    async fn upsert_file(
        &self,
        input: ScoreIndexUpsertFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexUpsertFileOutput, Box<dyn std::error::Error>>;

    async fn remove_by_file(
        &self,
        input: ScoreIndexRemoveByFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexRemoveByFileOutput, Box<dyn std::error::Error>>;

    async fn clear(
        &self,
        input: ScoreIndexClearInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexClearOutput, Box<dyn std::error::Error>>;

    async fn stats(
        &self,
        input: ScoreIndexStatsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ScoreIndexStatsOutput, Box<dyn std::error::Error>>;

}
