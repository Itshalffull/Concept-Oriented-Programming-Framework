// generated: daily_note/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DailyNoteHandler: Send + Sync {
    async fn get_or_create_today(
        &self,
        input: DailyNoteGetOrCreateTodayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteGetOrCreateTodayOutput, Box<dyn std::error::Error>>;

    async fn navigate_to_date(
        &self,
        input: DailyNoteNavigateToDateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteNavigateToDateOutput, Box<dyn std::error::Error>>;

    async fn list_recent(
        &self,
        input: DailyNoteListRecentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteListRecentOutput, Box<dyn std::error::Error>>;

}
