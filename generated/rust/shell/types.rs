// generated: shell/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellInitializeInput {
    pub shell: String,
    pub zones: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ShellInitializeOutput {
    Ok {
        shell: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellAssignToZoneInput {
    pub shell: String,
    pub zone: String,
    pub ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ShellAssignToZoneOutput {
    Ok {
        shell: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellClearZoneInput {
    pub shell: String,
    pub zone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ShellClearZoneOutput {
    Ok {
        shell: String,
        previous: Option<String>,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellPushOverlayInput {
    pub shell: String,
    pub ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ShellPushOverlayOutput {
    Ok {
        shell: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellPopOverlayInput {
    pub shell: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ShellPopOverlayOutput {
    Ok {
        shell: String,
        overlay: String,
    },
    Empty {
        message: String,
    },
}

