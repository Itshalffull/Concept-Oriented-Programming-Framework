// AnalysisRule concept implementation
// Declarative analysis rule for deriving facts from program entities --
// custom queries, linting, and architectural constraint validation.
// Supports multiple engine backends (datalog, graph traversal, pattern match).

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AnalysisRuleHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("analysis-rule-{}", id)
}

const VALID_ENGINES: &[&str] = &["datalog", "graph-traversal", "pattern-match"];
const VALID_SEVERITIES: &[&str] = &["error", "warning", "info"];

/// Simple pattern-matching evaluation engine. Interprets rule source
/// as JSON-encoded pattern descriptors with { match, message } entries.
fn evaluate_rule_source(
    engine: &str,
    source: &str,
    facts: &[serde_json::Value],
) -> Vec<serde_json::Value> {
    let mut findings = Vec::new();

    let patterns: Vec<serde_json::Value> = match serde_json::from_str(source) {
        Ok(p) => p,
        Err(_) => return findings,
    };

    for fact in facts {
        let fact_str = serde_json::to_string(fact).unwrap_or_default();
        for pattern in &patterns {
            let match_str = pattern["match"].as_str().unwrap_or("");
            let message = pattern["message"].as_str().unwrap_or("");
            let matched = match engine {
                "pattern-match" => fact_str.contains(match_str),
                "graph-traversal" => {
                    fact["kind"].as_str() == Some(match_str) || fact_str.contains(match_str)
                }
                "datalog" => {
                    fact["relation"].as_str() == Some(match_str) || fact_str.contains(match_str)
                }
                _ => false,
            };

            if matched {
                findings.push(json!({
                    "message": message,
                    "symbol": fact["symbol"].as_str().unwrap_or(""),
                    "file": fact["file"].as_str().unwrap_or(""),
                    "location": fact["location"].as_str().unwrap_or(""),
                }));
            }
        }
    }

    findings
}

pub struct AnalysisRuleHandlerImpl;

#[async_trait]
impl AnalysisRuleHandler for AnalysisRuleHandlerImpl {
    async fn create(
        &self,
        input: AnalysisRuleCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleCreateOutput, Box<dyn std::error::Error>> {
        // Validate engine
        if !VALID_ENGINES.contains(&input.engine.as_str()) {
            return Ok(AnalysisRuleCreateOutput::InvalidSyntax {
                message: format!(
                    "Unknown engine \"{}\". Must be one of: {}",
                    input.engine,
                    VALID_ENGINES.join(", ")
                ),
            });
        }

        // Validate source syntax: must be valid JSON
        if serde_json::from_str::<serde_json::Value>(&input.source).is_err() {
            return Ok(AnalysisRuleCreateOutput::InvalidSyntax {
                message: format!("Rule source is not valid JSON for engine \"{}\"", input.engine),
            });
        }

        let id = next_id();
        let severity = if VALID_SEVERITIES.contains(&input.severity.as_str()) {
            input.severity.clone()
        } else {
            "info".to_string()
        };

        storage.put("analysis-rule", &id, json!({
            "id": id,
            "name": input.name,
            "engine": input.engine,
            "source": input.source,
            "severity": severity,
            "category": input.category,
        })).await?;

        Ok(AnalysisRuleCreateOutput::Ok { rule: id })
    }

    async fn evaluate(
        &self,
        input: AnalysisRuleEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleEvaluateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("analysis-rule", &input.rule).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(AnalysisRuleEvaluateOutput::EvaluationError {
                message: format!("Rule \"{}\" not found", input.rule),
            }),
        };

        let engine = record["engine"].as_str().unwrap_or("");
        let source = record["source"].as_str().unwrap_or("");

        // Retrieve program facts from storage
        let facts = storage.find("analysis-fact", Some(&json!({}))).await?;
        let findings = evaluate_rule_source(engine, source, &facts);

        if findings.is_empty() {
            return Ok(AnalysisRuleEvaluateOutput::NoFindings);
        }

        Ok(AnalysisRuleEvaluateOutput::Ok {
            findings: serde_json::to_string(&findings)?,
        })
    }

    async fn evaluate_all(
        &self,
        input: AnalysisRuleEvaluateAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleEvaluateAllOutput, Box<dyn std::error::Error>> {
        // Retrieve all rules, optionally filtered by category
        let criteria = if input.category.is_empty() {
            None
        } else {
            Some(json!({ "category": input.category }))
        };
        let rules = storage.find("analysis-rule", criteria.as_ref()).await?;

        // Retrieve all program facts
        let facts = storage.find("analysis-fact", Some(&json!({}))).await?;

        let mut results = Vec::new();
        for rule in &rules {
            let engine = rule["engine"].as_str().unwrap_or("");
            let source = rule["source"].as_str().unwrap_or("");
            let findings = evaluate_rule_source(engine, source, &facts);
            results.push(json!({
                "rule": rule["id"].as_str().unwrap_or(""),
                "findingCount": findings.len(),
                "findings": findings,
            }));
        }

        Ok(AnalysisRuleEvaluateAllOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn get(
        &self,
        input: AnalysisRuleGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("analysis-rule", &input.rule).await?;
        match record {
            Some(r) => Ok(AnalysisRuleGetOutput::Ok {
                rule: r["id"].as_str().unwrap_or("").to_string(),
                name: r["name"].as_str().unwrap_or("").to_string(),
                engine: r["engine"].as_str().unwrap_or("").to_string(),
                severity: r["severity"].as_str().unwrap_or("").to_string(),
                category: r["category"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(AnalysisRuleGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_valid_rule() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let result = handler.create(
            AnalysisRuleCreateInput {
                name: "no-unused-imports".to_string(),
                engine: "pattern-match".to_string(),
                source: r#"[{"match":"unused","message":"Unused import detected"}]"#.to_string(),
                severity: "warning".to_string(),
                category: "lint".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleCreateOutput::Ok { rule } => {
                assert!(!rule.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_engine_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let result = handler.create(
            AnalysisRuleCreateInput {
                name: "test".to_string(),
                engine: "invalid-engine".to_string(),
                source: "[]".to_string(),
                severity: "error".to_string(),
                category: "lint".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleCreateOutput::InvalidSyntax { message } => {
                assert!(message.contains("Unknown engine"));
            }
            _ => panic!("Expected InvalidSyntax variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_json_source_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let result = handler.create(
            AnalysisRuleCreateInput {
                name: "test".to_string(),
                engine: "datalog".to_string(),
                source: "not-valid-json".to_string(),
                severity: "error".to_string(),
                category: "lint".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleCreateOutput::InvalidSyntax { message } => {
                assert!(message.contains("not valid JSON"));
            }
            _ => panic!("Expected InvalidSyntax variant"),
        }
    }

    #[tokio::test]
    async fn test_get_existing_rule() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let create_result = handler.create(
            AnalysisRuleCreateInput {
                name: "check-deps".to_string(),
                engine: "graph-traversal".to_string(),
                source: "[]".to_string(),
                severity: "info".to_string(),
                category: "architecture".to_string(),
            },
            &storage,
        ).await.unwrap();
        let rule_id = match create_result {
            AnalysisRuleCreateOutput::Ok { rule } => rule,
            _ => panic!("Expected Ok"),
        };
        let result = handler.get(
            AnalysisRuleGetInput { rule: rule_id },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleGetOutput::Ok { name, engine, .. } => {
                assert_eq!(name, "check-deps");
                assert_eq!(engine, "graph-traversal");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_rule_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let result = handler.get(
            AnalysisRuleGetInput { rule: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleGetOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_evaluate_nonexistent_rule_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = AnalysisRuleHandlerImpl;
        let result = handler.evaluate(
            AnalysisRuleEvaluateInput { rule: "missing-rule".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AnalysisRuleEvaluateOutput::EvaluationError { message } => {
                assert!(message.contains("not found"));
            }
            _ => panic!("Expected EvaluationError variant"),
        }
    }
}
