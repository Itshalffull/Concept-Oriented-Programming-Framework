// generated: capture/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaptureClipInput {
    pub url: String,
    pub mode: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CaptureClipOutput {
    Ok {
        item_id: String,
        content: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaptureImportInput {
    pub file: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CaptureImportOutput {
    Ok {
        item_id: String,
        content: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaptureSubscribeInput {
    pub source_id: String,
    pub schedule: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CaptureSubscribeOutput {
    Ok {
        subscription_id: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaptureDetectChangesInput {
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CaptureDetectChangesOutput {
    Ok {
        changeset: String,
    },
    Notfound {
        message: String,
    },
    Empty,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaptureMarkReadyInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CaptureMarkReadyOutput {
    Ok,
    Notfound {
        message: String,
    },
}

