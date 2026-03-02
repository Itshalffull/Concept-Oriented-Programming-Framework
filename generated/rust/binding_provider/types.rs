// generated: binding_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingProviderInitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindingProviderInitializeOutput {
    Ok {
        instance: String,
        plugin_ref: String,
    },
    ConfigError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingProviderBindInput {
    pub source: String,
    pub target: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindingProviderBindOutput {
    Ok {
        binding_id: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingProviderSyncInput {
    pub binding_id: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindingProviderSyncOutput {
    Ok {
        binding_id: String,
        synced: bool,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingProviderInvokeInput {
    pub binding_id: String,
    pub action: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindingProviderInvokeOutput {
    Ok {
        result: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingProviderUnbindInput {
    pub binding_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BindingProviderUnbindOutput {
    Ok {
        binding_id: String,
    },
    NotFound {
        message: String,
    },
}
