// generated: content/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentStoreInput {
    pub data: Vec<u8>,
    pub name: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentStoreOutput {
    Ok {
        cid: String,
        size: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentPinInput {
    pub cid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentPinOutput {
    Ok {
        cid: String,
    },
    Error {
        cid: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentUnpinInput {
    pub cid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentUnpinOutput {
    Ok {
        cid: String,
    },
    Error {
        cid: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentResolveInput {
    pub cid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentResolveOutput {
    Ok {
        data: Vec<u8>,
        content_type: String,
        size: i64,
    },
    NotFound {
        cid: String,
    },
    Unavailable {
        cid: String,
        message: String,
    },
}

