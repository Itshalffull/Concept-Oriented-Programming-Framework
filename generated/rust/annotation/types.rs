// generated: annotation/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnnotationAnnotateInput {
    pub concept: String,
    pub scope: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnnotationAnnotateOutput {
    Ok {
        annotation: String,
        key_count: i64,
    },
    InvalidScope {
        scope: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnnotationResolveInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnnotationResolveOutput {
    Ok {
        annotations: Vec<String>,
    },
    NotFound {
        concept: String,
    },
}

