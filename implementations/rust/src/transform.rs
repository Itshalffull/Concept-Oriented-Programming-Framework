// Transform Concept Implementation (Rust)
//
// Data integration kit — individual value conversion and chaining.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformApplyInput {
    pub value: String,
    pub transform_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TransformApplyOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformChainInput {
    pub value: String,
    pub transform_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TransformChainOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "error")]
    Error { message: String, failed_at: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformPreviewInput {
    pub value: String,
    pub transform_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum TransformPreviewOutput {
    #[serde(rename = "ok")]
    Ok { before: String, after: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

pub struct TransformHandler;

impl TransformHandler {
    fn apply_plugin(value: &str, plugin_id: &str) -> String {
        match plugin_id {
            "slugify" => {
                let slug: String = value
                    .to_lowercase()
                    .chars()
                    .map(|c| if c.is_alphanumeric() { c } else { '-' })
                    .collect();
                slug.trim_matches('-')
                    .split('-')
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join("-")
            }
            "strip_tags" => {
                let mut result = String::new();
                let mut in_tag = false;
                for ch in value.chars() {
                    match ch {
                        '<' => in_tag = true,
                        '>' => in_tag = false,
                        _ if !in_tag => result.push(ch),
                        _ => {}
                    }
                }
                result
            }
            "html_to_markdown" => {
                value
                    .replace("<b>", "**")
                    .replace("</b>", "**")
                    .replace("<strong>", "**")
                    .replace("</strong>", "**")
                    .replace("<i>", "*")
                    .replace("</i>", "*")
                    .replace("<em>", "*")
                    .replace("</em>", "*")
                    .replace("<p>", "")
                    .replace("</p>", "\n")
                    .trim()
                    .to_string()
            }
            _ => value.to_string(),
        }
    }

    pub async fn apply(
        &self,
        input: TransformApplyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TransformApplyOutput> {
        let existing = storage.get("transform", &input.transform_id).await?;
        match existing {
            None => Ok(TransformApplyOutput::Notfound {
                message: format!("Transform \"{}\" not found", input.transform_id),
            }),
            Some(record) => {
                let plugin_id = record["plugin_id"].as_str().unwrap_or("");
                let result = Self::apply_plugin(&input.value, plugin_id);
                Ok(TransformApplyOutput::Ok { result })
            }
        }
    }

    pub async fn chain(
        &self,
        input: TransformChainInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TransformChainOutput> {
        let ids: Vec<&str> = input
            .transform_ids
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let mut current = input.value.clone();
        for id in &ids {
            let existing = storage.get("transform", id).await?;
            match existing {
                None => {
                    return Ok(TransformChainOutput::Error {
                        message: format!("Transform \"{}\" not found", id),
                        failed_at: id.to_string(),
                    });
                }
                Some(record) => {
                    let plugin_id = record["plugin_id"].as_str().unwrap_or("");
                    current = Self::apply_plugin(&current, plugin_id);
                }
            }
        }

        Ok(TransformChainOutput::Ok { result: current })
    }

    pub async fn preview(
        &self,
        input: TransformPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TransformPreviewOutput> {
        let existing = storage.get("transform", &input.transform_id).await?;
        match existing {
            None => Ok(TransformPreviewOutput::Notfound {
                message: format!("Transform \"{}\" not found", input.transform_id),
            }),
            Some(record) => {
                let plugin_id = record["plugin_id"].as_str().unwrap_or("");
                let after = Self::apply_plugin(&input.value, plugin_id);
                Ok(TransformPreviewOutput::Ok {
                    before: input.value,
                    after,
                })
            }
        }
    }
}
