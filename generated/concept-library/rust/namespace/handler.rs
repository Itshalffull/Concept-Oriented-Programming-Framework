// generated: namespace/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NamespaceHandler: Send + Sync {
    async fn create_namespaced_page(
        &self,
        input: NamespaceCreateNamespacedPageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceCreateNamespacedPageOutput, Box<dyn std::error::Error>>;

    async fn get_children(
        &self,
        input: NamespaceGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceGetChildrenOutput, Box<dyn std::error::Error>>;

    async fn get_hierarchy(
        &self,
        input: NamespaceGetHierarchyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceGetHierarchyOutput, Box<dyn std::error::Error>>;

    async fn move(
        &self,
        input: NamespaceMoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceMoveOutput, Box<dyn std::error::Error>>;

}
