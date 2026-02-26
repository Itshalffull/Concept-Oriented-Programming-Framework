// Enricher Concept Implementation (Rust)
//
// Data integration kit — AI/API metadata augmentation with confidence scoring.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnricherEnrichInput {
    pub item_id: String,
    pub enricher_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EnricherEnrichOutput {
    #[serde(rename = "ok")]
    Ok {
        enrichment_id: String,
        result: String,
        confidence: String,
    },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnricherSuggestInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EnricherSuggestOutput {
    #[serde(rename = "ok")]
    Ok { suggestions: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnricherAcceptInput {
    pub item_id: String,
    pub enrichment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EnricherAcceptOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnricherRejectInput {
    pub item_id: String,
    pub enrichment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EnricherRejectOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnricherRefreshStaleInput {
    pub older_than: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EnricherRefreshStaleOutput {
    #[serde(rename = "ok")]
    Ok { refreshed: u64 },
}

pub struct EnricherHandler;

impl EnricherHandler {
    pub async fn enrich(
        &self,
        input: EnricherEnrichInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EnricherEnrichOutput> {
        let trigger = storage.get("enricher_trigger", &input.enricher_id).await?;
        if trigger.is_none() {
            return Ok(EnricherEnrichOutput::Notfound {
                message: format!("Enricher \"{}\" not found", input.enricher_id),
            });
        }

        let enrichment_id = format!("enr-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "enrichment",
                &enrichment_id,
                json!({
                    "enrichment_id": enrichment_id,
                    "item_id": input.item_id,
                    "plugin_id": trigger.unwrap()["plugin_id"],
                    "result": "{}",
                    "confidence": "0.0",
                    "status": "suggested",
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(EnricherEnrichOutput::Ok {
            enrichment_id,
            result: "{}".into(),
            confidence: "0.0".into(),
        })
    }

    pub async fn suggest(
        &self,
        input: EnricherSuggestInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EnricherSuggestOutput> {
        let triggers = storage.find("enricher_trigger", None).await?;
        let mut suggestions = Vec::new();

        for trigger in &triggers {
            let enrichment_id = format!("enr-{}", chrono::Utc::now().timestamp_millis());
            let enrichment = json!({
                "enrichment_id": enrichment_id,
                "item_id": input.item_id,
                "plugin_id": trigger["plugin_id"],
                "result": "{}",
                "confidence": "0.0",
                "status": "suggested",
                "generated_at": chrono::Utc::now().to_rfc3339(),
            });
            storage
                .put("enrichment", &enrichment_id, enrichment.clone())
                .await?;
            suggestions.push(enrichment);
        }

        Ok(EnricherSuggestOutput::Ok {
            suggestions: json!(suggestions).to_string(),
        })
    }

    pub async fn accept(
        &self,
        input: EnricherAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EnricherAcceptOutput> {
        let existing = storage.get("enrichment", &input.enrichment_id).await?;
        match existing {
            None => Ok(EnricherAcceptOutput::Notfound {
                message: format!("Enrichment \"{}\" not found", input.enrichment_id),
            }),
            Some(mut record) => {
                record["status"] = json!("accepted");
                storage
                    .put("enrichment", &input.enrichment_id, record)
                    .await?;
                Ok(EnricherAcceptOutput::Ok)
            }
        }
    }

    pub async fn reject(
        &self,
        input: EnricherRejectInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EnricherRejectOutput> {
        let existing = storage.get("enrichment", &input.enrichment_id).await?;
        match existing {
            None => Ok(EnricherRejectOutput::Notfound {
                message: format!("Enrichment \"{}\" not found", input.enrichment_id),
            }),
            Some(mut record) => {
                record["status"] = json!("rejected");
                storage
                    .put("enrichment", &input.enrichment_id, record)
                    .await?;
                Ok(EnricherRejectOutput::Ok)
            }
        }
    }

    pub async fn refresh_stale(
        &self,
        _input: EnricherRefreshStaleInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EnricherRefreshStaleOutput> {
        let all = storage.find("enrichment", None).await?;
        let mut refreshed: u64 = 0;

        for mut entry in all {
            let status = entry["status"].as_str().unwrap_or("");
            if status == "accepted" || status == "suggested" {
                entry["status"] = json!("stale");
                let eid = entry["enrichment_id"].as_str().unwrap_or("").to_string();
                storage.put("enrichment", &eid, entry).await?;
                refreshed += 1;
            }
        }

        Ok(EnricherRefreshStaleOutput::Ok { refreshed })
    }
}
