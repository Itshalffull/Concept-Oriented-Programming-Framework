// generated: g_t_k_adapter/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GTKAdapterNormalizeInput {
    pub adapter: String,
    pub props: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GTKAdapterNormalizeOutput {
    Ok {
        adapter: String,
        normalized: String,
    },
    Error {
        message: String,
    },
}

