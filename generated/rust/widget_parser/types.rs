// generated: widget_parser/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetParserParseInput {
    pub widget: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetParserParseOutput {
    Ok {
        widget: String,
        ast: String,
    },
    Error {
        widget: String,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetParserValidateInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetParserValidateOutput {
    Ok {
        widget: String,
    },
    Incomplete {
        widget: String,
        warnings: Vec<String>,
    },
}

