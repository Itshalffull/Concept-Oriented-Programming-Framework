// generated: inline_annotation/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationAnnotateInput {
    pub content_ref: String,
    pub change_type: String,
    pub scope: Vec<u8>,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationAnnotateOutput {
    Ok {
        annotation_id: String,
    },
    TrackingDisabled {
        message: String,
    },
    InvalidChangeType {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationAcceptInput {
    pub annotation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationAcceptOutput {
    Ok {
        clean_content: Vec<u8>,
    },
    NotFound {
        message: String,
    },
    AlreadyResolved {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationRejectInput {
    pub annotation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationRejectOutput {
    Ok {
        clean_content: Vec<u8>,
    },
    NotFound {
        message: String,
    },
    AlreadyResolved {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationAcceptAllInput {
    pub content_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationAcceptAllOutput {
    Ok {
        clean_content: Vec<u8>,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationRejectAllInput {
    pub content_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationRejectAllOutput {
    Ok {
        clean_content: Vec<u8>,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationToggleTrackingInput {
    pub content_ref: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationToggleTrackingOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InlineAnnotationListPendingInput {
    pub content_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InlineAnnotationListPendingOutput {
    Ok {
        annotations: Vec<String>,
    },
}

