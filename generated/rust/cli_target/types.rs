// generated: cli_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CliTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CliTargetGenerateOutput {
    Ok {
        commands: Vec<String>,
        files: Vec<String>,
    },
    TooManyPositional {
        action: String,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CliTargetValidateInput {
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CliTargetValidateOutput {
    Ok {
        command: String,
    },
    FlagCollision {
        command: String,
        flag: String,
        actions: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CliTargetListCommandsInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CliTargetListCommandsOutput {
    Ok {
        commands: Vec<String>,
        subcommands: Vec<String>,
    },
}

