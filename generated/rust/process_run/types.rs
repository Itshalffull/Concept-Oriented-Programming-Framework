// generated: process_run/types.rs
// Process instance lifecycle management: start, complete, fail, cancel, suspend, resume.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunStartInput {
    pub spec_ref: String,
    pub spec_version: i64,
    pub input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunStartOutput {
    Ok {
        run_id: String,
        spec_ref: String,
        status: String,
    },
    InvalidSpec {
        spec_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunStartChildInput {
    pub spec_ref: String,
    pub spec_version: i64,
    pub parent_run: String,
    pub input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunStartChildOutput {
    Ok {
        run_id: String,
        parent_run: String,
        status: String,
    },
    InvalidSpec {
        spec_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunCompleteInput {
    pub run_id: String,
    pub output: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunCompleteOutput {
    Ok {
        run_id: String,
        status: String,
    },
    NotRunning {
        run_id: String,
        current_status: String,
    },
    NotFound {
        run_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunFailInput {
    pub run_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunFailOutput {
    Ok {
        run_id: String,
        error: String,
        status: String,
    },
    NotRunning {
        run_id: String,
        current_status: String,
    },
    NotFound {
        run_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunCancelInput {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunCancelOutput {
    Ok {
        run_id: String,
        status: String,
    },
    NotCancellable {
        run_id: String,
        current_status: String,
    },
    NotFound {
        run_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunSuspendInput {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunSuspendOutput {
    Ok {
        run_id: String,
        status: String,
    },
    NotRunning {
        run_id: String,
        current_status: String,
    },
    NotFound {
        run_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunResumeInput {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunResumeOutput {
    Ok {
        run_id: String,
        status: String,
    },
    NotSuspended {
        run_id: String,
        current_status: String,
    },
    NotFound {
        run_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessRunGetStatusInput {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessRunGetStatusOutput {
    Ok {
        run_id: String,
        status: String,
        spec_ref: String,
    },
    NotFound {
        run_id: String,
    },
}
