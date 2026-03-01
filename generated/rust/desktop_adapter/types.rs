// generated: desktop_adapter/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesktopAdapterNormalizeInput {
    pub adapter: String,
    pub props: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesktopAdapterNormalizeOutput {
    Ok {
        adapter: String,
        normalized: String,
    },
    Error {
        message: String,
    },
}

