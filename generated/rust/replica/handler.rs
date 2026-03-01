// generated: replica/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ReplicaHandler: Send + Sync {
    async fn local_update(
        &self,
        input: ReplicaLocalUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaLocalUpdateOutput, Box<dyn std::error::Error>>;

    async fn receive_remote(
        &self,
        input: ReplicaReceiveRemoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaReceiveRemoteOutput, Box<dyn std::error::Error>>;

    async fn sync(
        &self,
        input: ReplicaSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaSyncOutput, Box<dyn std::error::Error>>;

    async fn get_state(
        &self,
        input: ReplicaGetStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaGetStateOutput, Box<dyn std::error::Error>>;

    async fn fork(
        &self,
        input: ReplicaForkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaForkOutput, Box<dyn std::error::Error>>;

    async fn add_peer(
        &self,
        input: ReplicaAddPeerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaAddPeerOutput, Box<dyn std::error::Error>>;

}
