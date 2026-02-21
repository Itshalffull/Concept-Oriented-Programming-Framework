// generated: display_mode/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DisplayModeDefineModeInput {
    pub mode: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DisplayModeDefineModeOutput {
    Ok {
        mode: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DisplayModeConfigureFieldDisplayInput {
    pub mode: String,
    pub field: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DisplayModeConfigureFieldDisplayOutput {
    Ok {
        mode: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DisplayModeConfigureFieldFormInput {
    pub mode: String,
    pub field: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DisplayModeConfigureFieldFormOutput {
    Ok {
        mode: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DisplayModeRenderInModeInput {
    pub mode: String,
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DisplayModeRenderInModeOutput {
    Ok {
        output: String,
    },
    Notfound {
        message: String,
    },
}

