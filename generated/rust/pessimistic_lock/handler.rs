// generated: pessimistic_lock/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PessimisticLockHandler: Send + Sync {
    async fn check_out(
        &self,
        input: PessimisticLockCheckOutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockCheckOutOutput, Box<dyn std::error::Error>>;

    async fn check_in(
        &self,
        input: PessimisticLockCheckInInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockCheckInOutput, Box<dyn std::error::Error>>;

    async fn break_lock(
        &self,
        input: PessimisticLockBreakLockInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockBreakLockOutput, Box<dyn std::error::Error>>;

    async fn renew(
        &self,
        input: PessimisticLockRenewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockRenewOutput, Box<dyn std::error::Error>>;

    async fn query_locks(
        &self,
        input: PessimisticLockQueryLocksInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockQueryLocksOutput, Box<dyn std::error::Error>>;

    async fn query_queue(
        &self,
        input: PessimisticLockQueryQueueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PessimisticLockQueryQueueOutput, Box<dyn std::error::Error>>;

}
