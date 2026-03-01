// generated: cloud_formation_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudFormationProviderGenerateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudFormationProviderGenerateOutput {
    Ok {
        stack: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudFormationProviderPreviewInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudFormationProviderPreviewOutput {
    Ok {
        stack: String,
        change_set_id: String,
        to_create: i64,
        to_update: i64,
        to_delete: i64,
    },
    ChangeSetEmpty {
        stack: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudFormationProviderApplyInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudFormationProviderApplyOutput {
    Ok {
        stack: String,
        stack_id: String,
        created: Vec<String>,
        updated: Vec<String>,
    },
    RollbackComplete {
        stack: String,
        reason: String,
    },
    Partial {
        stack: String,
        created: Vec<String>,
        failed: Vec<String>,
    },
    InsufficientCapabilities {
        stack: String,
        required: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudFormationProviderTeardownInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudFormationProviderTeardownOutput {
    Ok {
        stack: String,
        destroyed: Vec<String>,
    },
    DeletionFailed {
        stack: String,
        resource: String,
        reason: String,
    },
}

