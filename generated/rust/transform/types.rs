// generated: transform/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransformApplyInput {
    pub value: String,
    pub transform_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransformApplyOutput {
    Ok {
        result: String,
    },
    Notfound {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransformChainInput {
    pub value: String,
    pub transform_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransformChainOutput {
    Ok {
        result: String,
    },
    Error {
        message: String,
        failed_at: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransformPreviewInput {
    pub value: String,
    pub transform_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TransformPreviewOutput {
    Ok {
        before: String,
        after: String,
    },
    Notfound {
        message: String,
    },
}

