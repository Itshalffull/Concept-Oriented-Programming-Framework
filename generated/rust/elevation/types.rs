// generated: elevation/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElevationDefineInput {
    pub elevation: String,
    pub level: i64,
    pub shadow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ElevationDefineOutput {
    Ok {
        elevation: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElevationGetInput {
    pub elevation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ElevationGetOutput {
    Ok {
        elevation: String,
        shadow: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElevationGenerateScaleInput {
    pub base_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ElevationGenerateScaleOutput {
    Ok {
        shadows: String,
    },
    Invalid {
        message: String,
    },
}

