// generated: content_node/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeCreateInput {
    pub node: String,
    pub type: String,
    pub content: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeCreateOutput {
    Ok {
        node: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeUpdateInput {
    pub node: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeUpdateOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeDeleteInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeDeleteOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeGetInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeGetOutput {
    Ok {
        node: String,
        type: String,
        content: String,
        metadata: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeSetMetadataInput {
    pub node: String,
    pub metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeSetMetadataOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentNodeChangeTypeInput {
    pub node: String,
    pub type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentNodeChangeTypeOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

