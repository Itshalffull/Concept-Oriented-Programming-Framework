// generated: theme_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeGenGenerateInput {
    pub gen: String,
    pub target: String,
    pub theme_ast: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeGenGenerateOutput {
    Ok {
        gen: String,
        output: String,
    },
    Error {
        gen: String,
        message: String,
    },
}

