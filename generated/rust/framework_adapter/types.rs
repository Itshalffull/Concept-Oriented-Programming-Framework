// generated: framework_adapter/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameworkAdapterRegisterInput {
    pub renderer: String,
    pub framework: String,
    pub version: String,
    pub normalizer: String,
    pub mount_fn: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FrameworkAdapterRegisterOutput {
    Ok {
        renderer: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameworkAdapterNormalizeInput {
    pub renderer: String,
    pub props: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FrameworkAdapterNormalizeOutput {
    Ok {
        normalized: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameworkAdapterMountInput {
    pub renderer: String,
    pub machine: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FrameworkAdapterMountOutput {
    Ok {
        renderer: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameworkAdapterRenderInput {
    pub adapter: String,
    pub props: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FrameworkAdapterRenderOutput {
    Ok {
        adapter: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameworkAdapterUnmountInput {
    pub renderer: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FrameworkAdapterUnmountOutput {
    Ok {
        renderer: String,
    },
    Notfound {
        message: String,
    },
}

