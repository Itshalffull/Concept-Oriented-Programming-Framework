// generated: renderer/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RendererRenderInput {
    pub renderer: String,
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RendererRenderOutput {
    Ok {
        output: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RendererAutoPlaceholderInput {
    pub renderer: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RendererAutoPlaceholderOutput {
    Ok {
        placeholder: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RendererStreamInput {
    pub renderer: String,
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RendererStreamOutput {
    Ok {
        stream_id: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RendererMergeCacheabilityInput {
    pub renderer: String,
    pub tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RendererMergeCacheabilityOutput {
    Ok {
        merged: String,
    },
}

