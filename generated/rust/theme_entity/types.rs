// generated: theme_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityRegisterInput {
    pub name: String,
    pub source: String,
    pub ast: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityRegisterOutput {
    Ok {
        entity: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityGetInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityGetOutput {
    Ok {
        entity: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityResolveTokenInput {
    pub theme: String,
    pub token_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityResolveTokenOutput {
    Ok {
        resolved_value: String,
        resolution_chain: String,
    },
    Notfound {
        token_path: String,
    },
    BrokenChain {
        broken_at: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityContrastAuditInput {
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityContrastAuditOutput {
    Ok {
        all_passing: String,
        results: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityDiffThemesInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityDiffThemesOutput {
    Ok {
        differences: String,
    },
    Same,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityAffectedWidgetsInput {
    pub theme: String,
    pub changed_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityAffectedWidgetsOutput {
    Ok {
        widgets: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeEntityGeneratedOutputsInput {
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ThemeEntityGeneratedOutputsOutput {
    Ok {
        outputs: String,
    },
}

