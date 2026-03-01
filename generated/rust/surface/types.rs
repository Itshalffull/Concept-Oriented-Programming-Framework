// generated: surface/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceCreateInput {
    pub surface: String,
    pub kind: String,
    pub mount_point: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceCreateOutput {
    Ok {
        surface: String,
    },
    Unsupported {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceAttachInput {
    pub surface: String,
    pub renderer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceAttachOutput {
    Ok {
        surface: String,
    },
    Incompatible {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceResizeInput {
    pub surface: String,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceResizeOutput {
    Ok {
        surface: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceMountInput {
    pub surface: String,
    pub tree: String,
    pub zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceMountOutput {
    Ok {
        surface: String,
    },
    Error {
        message: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceUnmountInput {
    pub surface: String,
    pub zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceUnmountOutput {
    Ok {
        surface: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfaceDestroyInput {
    pub surface: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SurfaceDestroyOutput {
    Ok {
        surface: String,
    },
    Notfound {
        message: String,
    },
}

