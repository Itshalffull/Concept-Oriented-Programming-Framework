// generated: canvas/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasAddNodeInput {
    pub canvas: String,
    pub node: String,
    pub x: i64,
    pub y: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CanvasAddNodeOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasMoveNodeInput {
    pub canvas: String,
    pub node: String,
    pub x: i64,
    pub y: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CanvasMoveNodeOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasConnectNodesInput {
    pub canvas: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CanvasConnectNodesOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasGroupNodesInput {
    pub canvas: String,
    pub nodes: String,
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CanvasGroupNodesOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasEmbedFileInput {
    pub canvas: String,
    pub node: String,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CanvasEmbedFileOutput {
    Ok,
    Notfound {
        message: String,
    },
}

