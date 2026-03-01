// generated: checkpoint/types.rs
// Process state snapshot capture and restore for recovery and time-travel debugging.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckpointCaptureInput {
    pub run_ref: String,
    pub run_state: serde_json::Value,
    pub variables_snapshot: serde_json::Value,
    pub token_snapshot: serde_json::Value,
    pub event_cursor: i64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CheckpointCaptureOutput {
    Ok {
        checkpoint_id: String,
        timestamp: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckpointRestoreInput {
    pub checkpoint_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CheckpointRestoreOutput {
    Ok {
        checkpoint_id: String,
        run_state: serde_json::Value,
        variables_snapshot: serde_json::Value,
        token_snapshot: serde_json::Value,
        event_cursor: i64,
    },
    NotFound {
        checkpoint_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckpointFindLatestInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CheckpointFindLatestOutput {
    Ok {
        checkpoint_id: String,
        run_ref: String,
        timestamp: String,
    },
    None {
        run_ref: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckpointPruneInput {
    pub run_ref: String,
    pub keep_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CheckpointPruneOutput {
    Ok {
        pruned: i64,
    },
}
