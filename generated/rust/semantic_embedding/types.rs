// generated: semantic_embedding/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SemanticEmbeddingComputeInput {
    pub unit: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SemanticEmbeddingComputeOutput {
    Ok {
        embedding: String,
    },
    ModelUnavailable {
        model: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SemanticEmbeddingSearchSimilarInput {
    pub query_vector: String,
    pub top_k: i64,
    pub language: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SemanticEmbeddingSearchSimilarOutput {
    Ok {
        results: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SemanticEmbeddingSearchNaturalLanguageInput {
    pub query: String,
    pub top_k: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SemanticEmbeddingSearchNaturalLanguageOutput {
    Ok {
        results: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SemanticEmbeddingGetInput {
    pub embedding: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SemanticEmbeddingGetOutput {
    Ok {
        embedding: String,
        unit: String,
        model: String,
        dimensions: i64,
    },
    Notfound,
}

