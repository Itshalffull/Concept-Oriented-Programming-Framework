// generated: motion/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MotionHandler: Send + Sync {
    async fn define_duration(
        &self,
        input: MotionDefineDurationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineDurationOutput, Box<dyn std::error::Error>>;

    async fn define_easing(
        &self,
        input: MotionDefineEasingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineEasingOutput, Box<dyn std::error::Error>>;

    async fn define_transition(
        &self,
        input: MotionDefineTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineTransitionOutput, Box<dyn std::error::Error>>;

}
