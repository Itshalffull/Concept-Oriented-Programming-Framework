// generated: palette/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteGenerateInput {
    pub palette: String,
    pub name: String,
    pub seed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PaletteGenerateOutput {
    Ok {
        palette: String,
        scale: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteAssignRoleInput {
    pub palette: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PaletteAssignRoleOutput {
    Ok {
        palette: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteCheckContrastInput {
    pub foreground: String,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PaletteCheckContrastOutput {
    Ok {
        ratio: f64,
        passes_a_a: bool,
        passes_a_a_a: bool,
    },
    Notfound {
        message: String,
    },
}

