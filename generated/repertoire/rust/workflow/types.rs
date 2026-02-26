// generated: workflow/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowDefineStateInput {
    pub workflow: String,
    pub name: String,
    pub flags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkflowDefineStateOutput {
    Ok,
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowDefineTransitionInput {
    pub workflow: String,
    pub from: String,
    pub to: String,
    pub label: String,
    pub guard: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkflowDefineTransitionOutput {
    Ok,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowTransitionInput {
    pub workflow: String,
    pub entity: String,
    pub transition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkflowTransitionOutput {
    Ok {
        new_state: String,
    },
    Notfound {
        message: String,
    },
    Forbidden {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowGetCurrentStateInput {
    pub workflow: String,
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkflowGetCurrentStateOutput {
    Ok {
        state: String,
    },
    Notfound {
        message: String,
    },
}

