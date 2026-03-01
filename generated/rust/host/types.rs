// generated: host/types.rs

use serde::{Serialize, Deserialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostMountInput {
    pub host: String,
    pub concept: String,
    pub view: String,
    pub level: i64,
    pub zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HostMountOutput {
    Ok {
        host: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostReadyInput {
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HostReadyOutput {
    Ok {
        host: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostTrackResourceInput {
    pub host: String,
    pub kind: String,
    pub ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HostTrackResourceOutput {
    Ok {
        host: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostUnmountInput {
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum HostUnmountOutput {
    Ok {
        host: String,
        machines: HashSet<String>,
        binding: Option<String>,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostRefreshInput {
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HostRefreshOutput {
    Ok {
        host: String,
    },
    Notfound {
        message: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostSetErrorInput {
    pub host: String,
    pub error_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HostSetErrorOutput {
    Ok {
        host: String,
    },
    Notfound {
        message: String,
    },
}

