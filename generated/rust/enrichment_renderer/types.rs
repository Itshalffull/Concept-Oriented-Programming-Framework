// generated: enrichment_renderer/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnrichmentRendererRegisterInput {
    pub key: String,
    pub format: String,
    pub order: i64,
    pub pattern: String,
    pub template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnrichmentRendererRegisterOutput {
    Ok {
        handler: String,
    },
    UnknownPattern {
        pattern: String,
    },
    InvalidTemplate {
        template: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnrichmentRendererRenderInput {
    pub content: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnrichmentRendererRenderOutput {
    Ok {
        output: String,
        section_count: i64,
        unhandled_keys: Vec<String>,
    },
    InvalidContent {
        reason: String,
    },
    UnknownFormat {
        format: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnrichmentRendererListHandlersInput {
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnrichmentRendererListHandlersOutput {
    Ok {
        handlers: Vec<String>,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnrichmentRendererListPatternsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnrichmentRendererListPatternsOutput {
    Ok {
        patterns: Vec<String>,
    },
}

