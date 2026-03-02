// generated: viewport_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportProviderInitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportProviderInitializeOutput {
    Ok {
        instance: String,
        plugin_ref: String,
    },
    ConfigError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportProviderObserveInput {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportProviderObserveOutput {
    Ok {
        breakpoint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportProviderGetBreakpointInput {
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportProviderGetBreakpointOutput {
    Ok {
        breakpoint: String,
        min_width: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportProviderSetBreakpointsInput {
    pub breakpoints: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportProviderSetBreakpointsOutput {
    Ok {
        count: u32,
    },
}
