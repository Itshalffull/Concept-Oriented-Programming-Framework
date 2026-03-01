// Escalation concept handler trait
// Defines the async interface for escalation workflow actions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EscalationHandler: Send + Sync {
    async fn escalate(
        &self,
        input: EscalationEscalateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationEscalateOutput, Box<dyn std::error::Error>>;

    async fn accept(
        &self,
        input: EscalationAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationAcceptOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: EscalationResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationResolveOutput, Box<dyn std::error::Error>>;

    async fn re_escalate(
        &self,
        input: EscalationReEscalateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationReEscalateOutput, Box<dyn std::error::Error>>;
}
