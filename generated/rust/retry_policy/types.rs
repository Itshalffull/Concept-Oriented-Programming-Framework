// generated: retry_policy/types.rs
// Retry/backoff rules for failed steps with attempt tracking.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetryPolicyCreateInput {
    pub step_ref: String,
    pub run_ref: String,
    pub max_attempts: i64,
    pub initial_interval_ms: i64,
    pub backoff_coefficient: f64,
    pub max_interval_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetryPolicyCreateOutput {
    Ok {
        policy_id: String,
        step_ref: String,
        run_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetryPolicyShouldRetryInput {
    pub policy_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetryPolicyShouldRetryOutput {
    Retry {
        policy_id: String,
        delay_ms: i64,
        attempt: i64,
    },
    Exhausted {
        policy_id: String,
        step_ref: String,
        run_ref: String,
        last_error: String,
    },
    NotFound {
        policy_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetryPolicyRecordAttemptInput {
    pub policy_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetryPolicyRecordAttemptOutput {
    Ok {
        policy_id: String,
        attempt_count: i64,
    },
    NotFound {
        policy_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetryPolicyMarkSucceededInput {
    pub policy_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetryPolicyMarkSucceededOutput {
    Ok {
        policy_id: String,
    },
    NotFound {
        policy_id: String,
    },
}
