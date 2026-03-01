// generated: process_event/types.rs
// Structured event log for process execution history.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessEventAppendInput {
    pub run_ref: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessEventAppendOutput {
    Ok {
        event_id: String,
        sequence: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessEventQueryInput {
    pub run_ref: String,
    pub after_sequence: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessEventQueryOutput {
    Ok {
        events: Vec<serde_json::Value>,
        cursor: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessEventQueryByTypeInput {
    pub run_ref: String,
    pub event_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessEventQueryByTypeOutput {
    Ok {
        events: Vec<serde_json::Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessEventGetCursorInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessEventGetCursorOutput {
    Ok {
        cursor: i64,
    },
}
