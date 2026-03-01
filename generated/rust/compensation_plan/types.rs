// generated: compensation_plan/types.rs
// Saga-style compensating action tracking for rollback on failure.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompensationPlanRegisterInput {
    pub run_ref: String,
    pub step_key: String,
    pub action_descriptor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CompensationPlanRegisterOutput {
    Ok {
        plan_id: String,
        run_ref: String,
        compensation_count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompensationPlanTriggerInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CompensationPlanTriggerOutput {
    Ok {
        plan_id: String,
        status: String,
    },
    Empty {
        run_ref: String,
    },
    AlreadyTriggered {
        run_ref: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompensationPlanExecuteNextInput {
    pub plan_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CompensationPlanExecuteNextOutput {
    Ok {
        plan_id: String,
        step_key: String,
        action_descriptor: String,
    },
    AllDone {
        plan_id: String,
    },
    NotFound {
        plan_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompensationPlanMarkFailedInput {
    pub plan_id: String,
    pub step_key: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CompensationPlanMarkFailedOutput {
    Ok {
        plan_id: String,
        status: String,
    },
    NotFound {
        plan_id: String,
    },
}
