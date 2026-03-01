// generated: step_run/types.rs
// Individual step execution within a process run.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunStartInput {
    pub run_ref: String,
    pub step_ref: String,
    pub input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunStartOutput {
    Ok {
        step_run_id: String,
        status: String,
    },
    AlreadyRunning {
        step_run_id: String,
        step_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunCompleteInput {
    pub step_run_id: String,
    pub run_ref: String,
    pub output: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunCompleteOutput {
    Ok {
        step_run_id: String,
        status: String,
    },
    NotFound {
        step_run_id: String,
    },
    InvalidTransition {
        step_run_id: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunFailInput {
    pub step_run_id: String,
    pub run_ref: String,
    pub error: String,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunFailOutput {
    Ok {
        step_run_id: String,
        status: String,
    },
    NotFound {
        step_run_id: String,
    },
    InvalidTransition {
        step_run_id: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunCancelInput {
    pub step_run_id: String,
    pub run_ref: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunCancelOutput {
    Ok {
        step_run_id: String,
        status: String,
    },
    NotFound {
        step_run_id: String,
    },
    InvalidTransition {
        step_run_id: String,
        current_status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunSkipInput {
    pub run_ref: String,
    pub step_ref: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunSkipOutput {
    Ok {
        step_run_id: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StepRunGetInput {
    pub step_run_id: String,
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StepRunGetOutput {
    Ok {
        step_run_id: String,
        run_ref: String,
        step_ref: String,
        status: String,
        input: serde_json::Value,
        output: serde_json::Value,
    },
    NotFound {
        step_run_id: String,
    },
}
