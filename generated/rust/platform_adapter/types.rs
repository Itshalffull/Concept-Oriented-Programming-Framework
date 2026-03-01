// generated: platform_adapter/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlatformAdapterRegisterInput {
    pub adapter: String,
    pub platform: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PlatformAdapterRegisterOutput {
    Ok {
        adapter: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlatformAdapterMapNavigationInput {
    pub adapter: String,
    pub transition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PlatformAdapterMapNavigationOutput {
    Ok {
        adapter: String,
        platform_action: String,
    },
    Unsupported {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlatformAdapterMapZoneInput {
    pub adapter: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PlatformAdapterMapZoneOutput {
    Ok {
        adapter: String,
        platform_config: String,
    },
    Unmapped {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlatformAdapterHandlePlatformEventInput {
    pub adapter: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PlatformAdapterHandlePlatformEventOutput {
    Ok {
        adapter: String,
        action: String,
    },
    Ignored {
        message: String,
    },
}

