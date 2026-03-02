// generated: design_token_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenProviderInitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenProviderInitializeOutput {
    Ok {
        instance: String,
        plugin_ref: String,
    },
    ConfigError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenProviderResolveInput {
    pub token_name: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenProviderResolveOutput {
    Ok {
        token_name: String,
        value: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenProviderSwitchThemeInput {
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenProviderSwitchThemeOutput {
    Ok {
        theme: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenProviderGetTokensInput {
    pub theme: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenProviderGetTokensOutput {
    Ok {
        tokens: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenProviderExportInput {
    pub theme: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenProviderExportOutput {
    Ok {
        format: String,
        payload: String,
    },
}
