// generated: widget_scope_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetScopeProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetScopeProviderInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}

