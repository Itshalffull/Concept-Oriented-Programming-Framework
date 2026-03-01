// generated: widget_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetGenGenerateInput {
    pub gen: String,
    pub target: String,
    pub widget_ast: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetGenGenerateOutput {
    Ok {
        gen: String,
        output: String,
    },
    Error {
        gen: String,
        message: String,
    },
}

