// Enricher Handler Implementation
//
// Plugin-dispatched enrichment engine. Enriches items via registered
// enricher triggers, supports suggest/accept/reject lifecycle,
// and refresh-stale for maintaining enrichment freshness.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EnricherHandler;
use serde_json::json;

fn generate_enrichment_id() -> String {
    format!("enr-{}", chrono::Utc::now().timestamp_millis())
}

pub struct EnricherHandlerImpl;

#[async_trait]
impl EnricherHandler for EnricherHandlerImpl {
    async fn enrich(
        &self,
        input: EnricherEnrichInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherEnrichOutput, Box<dyn std::error::Error>> {
        let trigger = storage.get("enricherTrigger", &input.enricher_id).await?;
        if trigger.is_none() {
            return Ok(EnricherEnrichOutput::Notfound {
                message: format!("Enricher \"{}\" not found", input.enricher_id),
            });
        }

        let enrichment_id = generate_enrichment_id();
        let now = chrono::Utc::now().to_rfc3339();

        storage.put("enrichment", &enrichment_id, json!({
            "enrichmentId": enrichment_id,
            "itemId": input.item_id,
            "pluginId": trigger.unwrap().get("pluginId").and_then(|v| v.as_str()).unwrap_or(""),
            "result": "{}",
            "confidence": "0.0",
            "status": "suggested",
            "generatedAt": now,
        })).await?;

        Ok(EnricherEnrichOutput::Ok {
            enrichment_id,
            result: "{}".to_string(),
            confidence: "0.0".to_string(),
        })
    }

    async fn suggest(
        &self,
        input: EnricherSuggestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherSuggestOutput, Box<dyn std::error::Error>> {
        let triggers = storage.find("enricherTrigger", None).await?;
        let mut suggestions = Vec::new();

        for trigger in &triggers {
            let enrichment_id = generate_enrichment_id();
            let now = chrono::Utc::now().to_rfc3339();
            let enrichment = json!({
                "enrichmentId": enrichment_id,
                "itemId": input.item_id,
                "pluginId": trigger.get("pluginId").and_then(|v| v.as_str()).unwrap_or(""),
                "result": "{}",
                "confidence": "0.0",
                "status": "suggested",
                "generatedAt": now,
            });
            storage.put("enrichment", &enrichment_id, enrichment.clone()).await?;
            suggestions.push(enrichment);
        }

        Ok(EnricherSuggestOutput::Ok {
            suggestions: serde_json::to_string(&suggestions)?,
        })
    }

    async fn accept(
        &self,
        input: EnricherAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherAcceptOutput, Box<dyn std::error::Error>> {
        let enrichment = storage.get("enrichment", &input.enrichment_id).await?;
        match enrichment {
            Some(mut e) => {
                e["status"] = json!("accepted");
                storage.put("enrichment", &input.enrichment_id, e).await?;
                Ok(EnricherAcceptOutput::Ok)
            }
            None => Ok(EnricherAcceptOutput::Notfound {
                message: format!("Enrichment \"{}\" not found", input.enrichment_id),
            }),
        }
    }

    async fn reject(
        &self,
        input: EnricherRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherRejectOutput, Box<dyn std::error::Error>> {
        let enrichment = storage.get("enrichment", &input.enrichment_id).await?;
        match enrichment {
            Some(mut e) => {
                e["status"] = json!("rejected");
                storage.put("enrichment", &input.enrichment_id, e).await?;
                Ok(EnricherRejectOutput::Ok)
            }
            None => Ok(EnricherRejectOutput::Notfound {
                message: format!("Enrichment \"{}\" not found", input.enrichment_id),
            }),
        }
    }

    async fn refresh_stale(
        &self,
        input: EnricherRefreshStaleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherRefreshStaleOutput, Box<dyn std::error::Error>> {
        let all_enrichments = storage.find("enrichment", None).await?;
        let threshold_secs: i64 = input.older_than.parse().unwrap_or(3600);
        let threshold = chrono::Utc::now() - chrono::Duration::seconds(threshold_secs);
        let mut refreshed: i64 = 0;

        for enrichment in &all_enrichments {
            let status = enrichment.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if status == "accepted" || status == "suggested" {
                let generated_at = enrichment.get("generatedAt").and_then(|v| v.as_str()).unwrap_or("");
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(generated_at) {
                    if dt < threshold {
                        let enrichment_id = enrichment.get("enrichmentId").and_then(|v| v.as_str()).unwrap_or("");
                        let mut updated = enrichment.clone();
                        updated["status"] = json!("stale");
                        storage.put("enrichment", enrichment_id, updated).await?;
                        refreshed += 1;
                    }
                }
            }
        }

        Ok(EnricherRefreshStaleOutput::Ok { refreshed })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_enrich_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EnricherHandlerImpl;
        let result = handler.enrich(
            EnricherEnrichInput {
                item_id: "item-1".to_string(),
                enricher_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnricherEnrichOutput::Notfound { message } => {
                assert!(message.contains("missing"));
            },
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_enrich_success() {
        let storage = InMemoryStorage::new();
        storage.put("enricherTrigger", "enr-t1", json!({"pluginId": "plugin-1"})).await.unwrap();
        let handler = EnricherHandlerImpl;
        let result = handler.enrich(
            EnricherEnrichInput {
                item_id: "item-1".to_string(),
                enricher_id: "enr-t1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnricherEnrichOutput::Ok { enrichment_id, .. } => {
                assert!(!enrichment_id.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EnricherHandlerImpl;
        let result = handler.accept(
            EnricherAcceptInput {
                item_id: "item-1".to_string(),
                enrichment_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnricherAcceptOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EnricherHandlerImpl;
        let result = handler.reject(
            EnricherRejectInput {
                item_id: "item-1".to_string(),
                enrichment_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnricherRejectOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_refresh_stale_empty() {
        let storage = InMemoryStorage::new();
        let handler = EnricherHandlerImpl;
        let result = handler.refresh_stale(
            EnricherRefreshStaleInput {
                older_than: "3600".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EnricherRefreshStaleOutput::Ok { refreshed } => {
                assert_eq!(refreshed, 0);
            },
        }
    }
}
