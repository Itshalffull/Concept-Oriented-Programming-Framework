// generated: content_hash/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentHashStoreInput {
    pub content: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentHashStoreOutput {
    Ok {
        hash: String,
    },
    AlreadyExists {
        hash: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentHashRetrieveInput {
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentHashRetrieveOutput {
    Ok {
        content: Vec<u8>,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentHashVerifyInput {
    pub hash: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentHashVerifyOutput {
    Valid,
    Corrupt {
        expected: String,
        actual: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentHashDeleteInput {
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentHashDeleteOutput {
    Ok,
    NotFound {
        message: String,
    },
    Referenced {
        message: String,
    },
}

