// generated: grouping/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GroupingHandler: Send + Sync {
    async fn group(
        &self,
        input: GroupingGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupingGroupOutput, Box<dyn std::error::Error>>;

    async fn classify(
        &self,
        input: GroupingClassifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupingClassifyOutput, Box<dyn std::error::Error>>;

}
