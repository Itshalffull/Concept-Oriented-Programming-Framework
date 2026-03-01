// generated: theme_parser/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeParserParseInput {
    pub theme: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeParserParseOutput {
    Ok {
        theme: String,
        ast: String,
    },
    Error {
        theme: String,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeParserCheckContrastInput {
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeParserCheckContrastOutput {
    Ok {
        theme: String,
    },
    Violations {
        theme: String,
        failures: Vec<String>,
    },
}

