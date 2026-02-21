// generated: outline/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineCreateInput {
    pub node: String,
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineCreateOutput {
    Ok {
        node: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineIndentInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineIndentOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineOutdentInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineOutdentOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineMoveUpInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineMoveUpOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineMoveDownInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineMoveDownOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineCollapseInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineCollapseOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineExpandInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineExpandOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineReparentInput {
    pub node: String,
    pub new_parent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineReparentOutput {
    Ok {
        node: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineGetChildrenInput {
    pub node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OutlineGetChildrenOutput {
    Ok {
        children: String,
    },
    Notfound {
        message: String,
    },
}

