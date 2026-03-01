// generated: action_guide/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionGuideDefineInput {
    pub concept: String,
    pub steps: Vec<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionGuideDefineOutput {
    Ok {
        workflow: String,
        step_count: i64,
    },
    InvalidAction {
        action: String,
    },
    EmptySteps,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionGuideRenderInput {
    pub workflow: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionGuideRenderOutput {
    Ok {
        content: String,
    },
    UnknownFormat {
        format: String,
    },
}

