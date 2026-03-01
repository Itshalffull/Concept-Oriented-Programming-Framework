// generated: tree_sitter_widget_spec/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterWidgetSpecInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterWidgetSpecInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}

