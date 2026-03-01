// generated: viewport/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportObserveInput {
    pub viewport: String,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportObserveOutput {
    Ok {
        viewport: String,
        breakpoint: String,
        orientation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportSetBreakpointsInput {
    pub viewport: String,
    pub breakpoints: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportSetBreakpointsOutput {
    Ok {
        viewport: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewportGetBreakpointInput {
    pub viewport: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ViewportGetBreakpointOutput {
    Ok {
        viewport: String,
        breakpoint: String,
        width: i64,
        height: i64,
    },
    Notfound {
        message: String,
    },
}

