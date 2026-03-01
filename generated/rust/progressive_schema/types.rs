// generated: progressive_schema/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaCaptureFreeformInput {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaCaptureFreeformOutput {
    Ok {
        item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaDetectStructureInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaDetectStructureOutput {
    Ok {
        suggestions: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaAcceptSuggestionInput {
    pub item_id: String,
    pub suggestion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaAcceptSuggestionOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaRejectSuggestionInput {
    pub item_id: String,
    pub suggestion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaRejectSuggestionOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaPromoteInput {
    pub item_id: String,
    pub target_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaPromoteOutput {
    Ok {
        result: String,
    },
    Notfound {
        message: String,
    },
    Incomplete {
        gaps: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressiveSchemaInferSchemaInput {
    pub items: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaInferSchemaOutput {
    Ok {
        proposed_schema: String,
    },
    Error {
        message: String,
    },
}

