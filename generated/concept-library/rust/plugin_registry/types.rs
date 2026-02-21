// generated: plugin_registry/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginRegistryDiscoverInput {
    pub type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PluginRegistryDiscoverOutput {
    Ok {
        plugins: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginRegistryCreateInstanceInput {
    pub plugin: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PluginRegistryCreateInstanceOutput {
    Ok {
        instance: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginRegistryGetDefinitionsInput {
    pub type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PluginRegistryGetDefinitionsOutput {
    Ok {
        definitions: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginRegistryAlterDefinitionsInput {
    pub type: String,
    pub alterations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PluginRegistryAlterDefinitionsOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginRegistryDerivePluginsInput {
    pub plugin: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PluginRegistryDerivePluginsOutput {
    Ok {
        derived: String,
    },
    Notfound,
}

