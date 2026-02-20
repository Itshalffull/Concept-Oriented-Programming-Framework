// generated: sync_engine/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineRegisterSyncInput {
    pub sync: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineRegisterSyncOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineOnCompletionInput {
    pub completion: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineOnCompletionOutput {
    Ok {
        invocations: Vec<serde_json::Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineEvaluateWhereInput {
    pub bindings: serde_json::Value,
    pub queries: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineEvaluateWhereOutput {
    Ok {
        results: Vec<serde_json::Value>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineQueueSyncInput {
    pub sync: serde_json::Value,
    pub bindings: serde_json::Value,
    pub flow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineQueueSyncOutput {
    Ok {
        pending_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineOnAvailabilityChangeInput {
    pub concept_uri: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineOnAvailabilityChangeOutput {
    Ok {
        drained: Vec<serde_json::Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEngineDrainConflictsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEngineDrainConflictsOutput {
    Ok {
        conflicts: Vec<serde_json::Value>,
    },
}

