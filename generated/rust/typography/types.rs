// generated: typography/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypographyDefineScaleInput {
    pub typography: String,
    pub base_size: f64,
    pub ratio: f64,
    pub steps: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypographyDefineScaleOutput {
    Ok {
        typography: String,
        scale: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypographyDefineFontStackInput {
    pub typography: String,
    pub name: String,
    pub fonts: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypographyDefineFontStackOutput {
    Ok {
        typography: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypographyDefineStyleInput {
    pub typography: String,
    pub name: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TypographyDefineStyleOutput {
    Ok {
        typography: String,
    },
    Invalid {
        message: String,
    },
}

