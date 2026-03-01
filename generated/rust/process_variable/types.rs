// generated: process_variable/types.rs
// Key-value variable store scoped to a process run.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableSetInput {
    pub run_ref: String,
    pub name: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableSetOutput {
    Ok {
        run_ref: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableGetInput {
    pub run_ref: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableGetOutput {
    Ok {
        name: String,
        value: serde_json::Value,
    },
    NotFound {
        run_ref: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableMergeInput {
    pub run_ref: String,
    pub name: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableMergeOutput {
    Ok {
        name: String,
        merged: serde_json::Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableDeleteInput {
    pub run_ref: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableDeleteOutput {
    Ok {
        run_ref: String,
        name: String,
    },
    NotFound {
        run_ref: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableListInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableListOutput {
    Ok {
        variables: Vec<serde_json::Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessVariableSnapshotInput {
    pub run_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessVariableSnapshotOutput {
    Ok {
        snapshot_id: String,
        variables: serde_json::Value,
    },
}
