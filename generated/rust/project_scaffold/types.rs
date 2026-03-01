// generated: project_scaffold/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectScaffoldScaffoldInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProjectScaffoldScaffoldOutput {
    Ok {
        project: String,
        path: String,
    },
    AlreadyExists {
        name: String,
    },
}

