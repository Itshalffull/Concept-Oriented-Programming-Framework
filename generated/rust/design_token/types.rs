// generated: design_token/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenDefineInput {
    pub token: String,
    pub name: String,
    pub value: String,
    pub type: String,
    pub tier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenDefineOutput {
    Ok {
        token: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenAliasInput {
    pub token: String,
    pub name: String,
    pub reference: String,
    pub tier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenAliasOutput {
    Ok {
        token: String,
    },
    Notfound {
        message: String,
    },
    Cycle {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenResolveInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenResolveOutput {
    Ok {
        token: String,
        resolved_value: String,
    },
    Notfound {
        message: String,
    },
    Broken {
        message: String,
        broken_at: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenUpdateInput {
    pub token: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenUpdateOutput {
    Ok {
        token: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenRemoveInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenRemoveOutput {
    Ok {
        token: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DesignTokenExportInput {
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DesignTokenExportOutput {
    Ok {
        output: String,
    },
    Unsupported {
        message: String,
    },
}

