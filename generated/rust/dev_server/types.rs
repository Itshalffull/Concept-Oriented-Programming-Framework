// generated: dev_server/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DevServerStartInput {
    pub port: i64,
    pub watch_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DevServerStartOutput {
    Ok {
        session: String,
        port: i64,
        url: String,
    },
    PortInUse {
        port: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DevServerStopInput {
    pub session: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DevServerStopOutput {
    Ok {
        session: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DevServerStatusInput {
    pub session: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DevServerStatusOutput {
    Running {
        port: i64,
        uptime: i64,
        last_recompile: String,
    },
    Stopped,
}

