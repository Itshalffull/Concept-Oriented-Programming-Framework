// generated: file_management/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FileManagementHandler: Send + Sync {
    async fn upload(
        &self,
        input: FileManagementUploadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementUploadOutput, Box<dyn std::error::Error>>;

    async fn add_usage(
        &self,
        input: FileManagementAddUsageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementAddUsageOutput, Box<dyn std::error::Error>>;

    async fn remove_usage(
        &self,
        input: FileManagementRemoveUsageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementRemoveUsageOutput, Box<dyn std::error::Error>>;

    async fn garbage_collect(
        &self,
        input: FileManagementGarbageCollectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementGarbageCollectOutput, Box<dyn std::error::Error>>;

    async fn get_file(
        &self,
        input: FileManagementGetFileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileManagementGetFileOutput, Box<dyn std::error::Error>>;

}
