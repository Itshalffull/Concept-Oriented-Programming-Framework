// generated: claude_skills_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaudeSkillsTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ClaudeSkillsTargetGenerateOutput {
    Ok {
        skills: Vec<String>,
        files: Vec<String>,
    },
    MissingProjection {
        concept: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaudeSkillsTargetValidateInput {
    pub skill: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ClaudeSkillsTargetValidateOutput {
    Ok {
        skill: String,
    },
    InvalidFrontmatter {
        skill: String,
        errors: Vec<String>,
    },
    BrokenReferences {
        skill: String,
        missing: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaudeSkillsTargetListSkillsInput {
    pub kit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ClaudeSkillsTargetListSkillsOutput {
    Ok {
        skills: Vec<String>,
        enriched: Vec<String>,
        flat: Vec<String>,
    },
}

