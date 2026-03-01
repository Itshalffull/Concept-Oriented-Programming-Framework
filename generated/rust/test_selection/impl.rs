// TestSelection concept implementation
// Change-aware test selection using source-to-test coverage mappings.
// Selects minimum test set for confident defect detection given a code change.
// See Architecture doc Section 3.8

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TestSelectionHandler;
use serde_json::json;
use std::collections::HashSet;

const MAPPINGS: &str = "test-selection-mappings";
const SELECTIONS: &str = "test-selection-history";

pub struct TestSelectionHandlerImpl;

#[async_trait]
impl TestSelectionHandler for TestSelectionHandlerImpl {
    async fn analyze(
        &self,
        input: TestSelectionAnalyzeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionAnalyzeOutput, Box<dyn std::error::Error>> {
        if input.changed_sources.is_empty() {
            return Ok(TestSelectionAnalyzeOutput::NoMappings {
                message: "No changed sources provided".to_string(),
            });
        }

        let all_mappings = storage.find(MAPPINGS, None).await?;
        if all_mappings.is_empty() {
            return Ok(TestSelectionAnalyzeOutput::NoMappings {
                message: "No coverage mappings available -- run tests with coverage first".to_string(),
            });
        }

        let changed_set: HashSet<&str> = input.changed_sources.iter().map(|s| s.as_str()).collect();
        let mut affected_tests: Vec<serde_json::Value> = Vec::new();
        let mut seen = HashSet::new();

        for mapping in &all_mappings {
            let test_id = mapping["testId"].as_str().unwrap_or("");
            let language = mapping["language"].as_str().unwrap_or("");
            let mapping_test_type = mapping["testType"].as_str().unwrap_or("unit");

            // Filter by testType if specified
            if let Some(ref test_type) = input.test_type {
                if mapping_test_type != test_type {
                    continue;
                }
            }

            let covered_str = mapping["coveredSources"].as_str().unwrap_or("[]");
            let covered: Vec<String> = serde_json::from_str(covered_str).unwrap_or_default();

            // Check direct coverage
            let direct_hit = covered.iter().any(|s| changed_set.contains(s.as_str()));
            let dedup_key = format!("{}:{}", test_id, language);

            if direct_hit && seen.insert(dedup_key.clone()) {
                affected_tests.push(json!({
                    "test_id": test_id,
                    "language": language,
                    "test_type": mapping_test_type,
                    "relevance": 1.0,
                    "reason": "direct-coverage"
                }));
                continue;
            }

            // Check transitive dependency (simplified: partial path overlap)
            let transitive_hit = covered.iter().any(|s| {
                let s_base = s.rsplit('/').next().unwrap_or(s);
                input.changed_sources.iter().any(|changed| {
                    let changed_base = changed.rsplit('/').next().unwrap_or(changed);
                    s.contains(changed_base) || changed.contains(s_base)
                })
            });

            if transitive_hit && seen.insert(dedup_key) {
                affected_tests.push(json!({
                    "test_id": test_id,
                    "language": language,
                    "test_type": mapping_test_type,
                    "relevance": 0.7,
                    "reason": "transitive-dep"
                }));
            }
        }

        Ok(TestSelectionAnalyzeOutput::Ok {
            affected_tests,
        })
    }

    async fn select(
        &self,
        input: TestSelectionSelectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionSelectOutput, Box<dyn std::error::Error>> {
        if input.affected_tests.is_empty() {
            return Ok(TestSelectionSelectOutput::Ok {
                selected: vec![],
                estimated_duration: 0,
                confidence: 1.0,
            });
        }

        // Sort by relevance descending
        let mut sorted = input.affected_tests.clone();
        sorted.sort_by(|a, b| {
            let a_rel = a["relevance"].as_f64().unwrap_or(0.0);
            let b_rel = b["relevance"].as_f64().unwrap_or(0.0);
            b_rel.partial_cmp(&a_rel).unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut total_duration = 0_i64;
        let mut selected: Vec<serde_json::Value> = Vec::new();

        let max_tests = input.budget.as_ref().and_then(|b| b["max_tests"].as_i64());
        let max_duration = input.budget.as_ref().and_then(|b| b["max_duration"].as_i64());

        for (i, test) in sorted.iter().enumerate() {
            let test_id = test["test_id"].as_str().unwrap_or("");
            let language = test["language"].as_str().unwrap_or("");
            let mapping_key = format!("{}:{}", test_id, language);
            let mapping = storage.get(MAPPINGS, &mapping_key).await?;
            let avg_duration = mapping.as_ref()
                .and_then(|m| m["avgDuration"].as_i64())
                .unwrap_or(100);

            if let Some(max_t) = max_tests {
                if selected.len() as i64 >= max_t { break; }
            }
            if let Some(max_d) = max_duration {
                if total_duration + avg_duration > max_d {
                    let missed_tests = sorted.len() as i64 - selected.len() as i64;
                    let confidence = if sorted.is_empty() { 1.0 } else {
                        selected.len() as f64 / sorted.len() as f64
                    };

                    let selection_id = format!("sel-{}", chrono::Utc::now().timestamp_millis());
                    storage.put(SELECTIONS, &selection_id, json!({
                        "id": selection_id,
                        "selectedCount": selected.len(),
                        "totalAffected": sorted.len(),
                        "confidence": confidence,
                        "estimatedDuration": total_duration,
                        "createdAt": chrono::Utc::now().to_rfc3339()
                    })).await?;

                    return Ok(TestSelectionSelectOutput::BudgetInsufficient {
                        selected: selected.iter().map(|s| json!({"test_id": s["test_id"]})).collect(),
                        missed_tests,
                        confidence,
                    });
                }
            }

            selected.push(json!({
                "test_id": test_id,
                "language": language,
                "test_type": test["test_type"].as_str().unwrap_or("unit"),
                "priority": i + 1
            }));
            total_duration += avg_duration;
        }

        let selection_id = format!("sel-{}", chrono::Utc::now().timestamp_millis());
        storage.put(SELECTIONS, &selection_id, json!({
            "id": selection_id,
            "selectedCount": selected.len(),
            "totalAffected": sorted.len(),
            "confidence": 1.0,
            "estimatedDuration": total_duration,
            "createdAt": chrono::Utc::now().to_rfc3339()
        })).await?;

        Ok(TestSelectionSelectOutput::Ok {
            selected,
            estimated_duration: total_duration,
            confidence: 1.0,
        })
    }

    async fn record(
        &self,
        input: TestSelectionRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionRecordOutput, Box<dyn std::error::Error>> {
        let mapping_key = format!("{}:{}", input.test_id, input.language);
        let existing = storage.get(MAPPINGS, &mapping_key).await?;

        let (avg_duration, failure_rate, run_count, mapping_id) = if let Some(ref record) = existing {
            let prev_avg = record["avgDuration"].as_i64().unwrap_or(0);
            let prev_rate = record["failureRate"].as_f64().unwrap_or(0.0);
            let prev_runs = record["runCount"].as_i64().unwrap_or(1);
            let runs = prev_runs + 1;
            let avg = (prev_avg * prev_runs + input.duration) / runs;
            let rate = (prev_rate * prev_runs as f64 + if input.passed { 0.0 } else { 1.0 }) / runs as f64;
            let id = record["id"].as_str().unwrap_or("").to_string();
            (avg, rate, runs, id)
        } else {
            let id = format!("map-{}", chrono::Utc::now().timestamp_millis());
            (input.duration, if input.passed { 0.0 } else { 1.0 }, 1_i64, id)
        };

        storage.put(MAPPINGS, &mapping_key, json!({
            "id": mapping_id,
            "testId": input.test_id,
            "language": input.language,
            "testType": input.test_type,
            "coveredSources": serde_json::to_string(&input.covered_sources)?,
            "avgDuration": avg_duration,
            "failureRate": failure_rate,
            "runCount": run_count,
            "lastExecuted": chrono::Utc::now().to_rfc3339()
        })).await?;

        Ok(TestSelectionRecordOutput::Ok {
            mapping: mapping_id,
        })
    }

    async fn statistics(
        &self,
        _input: TestSelectionStatisticsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TestSelectionStatisticsOutput, Box<dyn std::error::Error>> {
        let all_mappings = storage.find(MAPPINGS, None).await?;
        let all_selections = storage.find(SELECTIONS, None).await?;

        let total_mappings = all_mappings.len() as i64;
        let mut avg_selection_ratio = 0.0_f64;
        let mut avg_confidence = 0.0_f64;
        let mut last_updated = String::new();

        if !all_selections.is_empty() {
            let mut total_ratio = 0.0_f64;
            let mut total_conf = 0.0_f64;

            for sel in &all_selections {
                let selected = sel["selectedCount"].as_i64().unwrap_or(0) as f64;
                let total = sel["totalAffected"].as_i64().unwrap_or(0) as f64;
                total_ratio += if total > 0.0 { selected / total } else { 1.0 };
                total_conf += sel["confidence"].as_f64().unwrap_or(0.0);
                let created = sel["createdAt"].as_str().unwrap_or("");
                if created > last_updated.as_str() {
                    last_updated = created.to_string();
                }
            }

            avg_selection_ratio = total_ratio / all_selections.len() as f64;
            avg_confidence = total_conf / all_selections.len() as f64;
        }

        if last_updated.is_empty() {
            for m in &all_mappings {
                let executed = m["lastExecuted"].as_str().unwrap_or("");
                if executed > last_updated.as_str() {
                    last_updated = executed.to_string();
                }
            }
        }

        if last_updated.is_empty() {
            last_updated = chrono::Utc::now().to_rfc3339();
        }

        Ok(TestSelectionStatisticsOutput::Ok {
            stats: json!({
                "total_mappings": total_mappings,
                "avg_selection_ratio": (avg_selection_ratio * 1000.0).round() / 1000.0,
                "avg_confidence": (avg_confidence * 1000.0).round() / 1000.0,
                "last_updated": last_updated
            }),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_analyze_no_changed_sources() {
        let storage = InMemoryStorage::new();
        let handler = TestSelectionHandlerImpl;
        let result = handler.analyze(
            TestSelectionAnalyzeInput {
                changed_sources: vec![],
                test_type: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TestSelectionAnalyzeOutput::NoMappings { .. } => {},
            _ => panic!("Expected NoMappings variant"),
        }
    }

    #[tokio::test]
    async fn test_analyze_no_mappings() {
        let storage = InMemoryStorage::new();
        let handler = TestSelectionHandlerImpl;
        let result = handler.analyze(
            TestSelectionAnalyzeInput {
                changed_sources: vec!["src/main.ts".to_string()],
                test_type: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TestSelectionAnalyzeOutput::NoMappings { .. } => {},
            _ => panic!("Expected NoMappings variant"),
        }
    }

    #[tokio::test]
    async fn test_select_empty_tests() {
        let storage = InMemoryStorage::new();
        let handler = TestSelectionHandlerImpl;
        let result = handler.select(
            TestSelectionSelectInput {
                affected_tests: vec![],
                budget: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TestSelectionSelectOutput::Ok { selected, confidence, .. } => {
                assert!(selected.is_empty());
                assert_eq!(confidence, 1.0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_record_new_mapping() {
        let storage = InMemoryStorage::new();
        let handler = TestSelectionHandlerImpl;
        let result = handler.record(
            TestSelectionRecordInput {
                test_id: "test-1".to_string(),
                language: "typescript".to_string(),
                test_type: "unit".to_string(),
                covered_sources: vec!["src/main.ts".to_string()],
                duration: 150,
                passed: true,
            },
            &storage,
        ).await.unwrap();
        match result {
            TestSelectionRecordOutput::Ok { mapping } => {
                assert!(!mapping.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_statistics_empty() {
        let storage = InMemoryStorage::new();
        let handler = TestSelectionHandlerImpl;
        let result = handler.statistics(
            TestSelectionStatisticsInput {},
            &storage,
        ).await.unwrap();
        match result {
            TestSelectionStatisticsOutput::Ok { stats } => {
                assert_eq!(stats["total_mappings"], 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
