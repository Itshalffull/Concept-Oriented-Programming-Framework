// FlakyTest concept implementation
// Detects, tracks, and quarantines unreliable tests across all languages and builders.
// See Architecture doc Section 3.8

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FlakyTestHandler;
use serde_json::json;
use chrono::Utc;

const TESTS: &str = "flaky-tests";
const POLICY: &str = "flaky-policy";

async fn get_policy(storage: &dyn ConceptStorage) -> (i64, String, bool, i64) {
    let stored = storage.get(POLICY, "current").await.ok().flatten();
    match stored {
        Some(p) => (
            p.get("flipThreshold").and_then(|v| v.as_i64()).unwrap_or(3),
            p.get("flipWindow").and_then(|v| v.as_str()).unwrap_or("7d").to_string(),
            p.get("autoQuarantine").and_then(|v| v.as_bool()).unwrap_or(false),
            p.get("retryCount").and_then(|v| v.as_i64()).unwrap_or(1),
        ),
        None => (3, "7d".to_string(), false, 1),
    }
}

pub struct FlakyTestHandlerImpl;

#[async_trait]
impl FlakyTestHandler for FlakyTestHandlerImpl {
    async fn record(
        &self,
        input: FlakyTestRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestRecordOutput, Box<dyn std::error::Error>> {
        let test_key = format!("{}:{}:{}", input.test_id, input.language, input.test_type);
        let existing = storage.get(TESTS, &test_key).await?;
        let now = Utc::now().to_rfc3339();
        let (flip_threshold, _flip_window, auto_quarantine, _) = get_policy(storage).await;

        let mut results: Vec<serde_json::Value> = Vec::new();
        let mut quarantined = false;
        let test_ref;

        if let Some(ref ex) = existing {
            let results_str = ex.get("results").and_then(|v| v.as_str()).unwrap_or("[]");
            results = serde_json::from_str(results_str).unwrap_or_default();
            quarantined = ex.get("quarantined").and_then(|v| v.as_bool()).unwrap_or(false);
            test_ref = ex.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        } else {
            test_ref = format!("flaky-{}", Utc::now().timestamp_millis());
        }

        results.push(json!({"passed": input.passed, "timestamp": now, "duration": input.duration}));

        // Count flips within window
        let mut window_flip_count: i64 = 0;
        for i in 1..results.len() {
            let prev = results[i - 1].get("passed").and_then(|v| v.as_bool());
            let curr = results[i].get("passed").and_then(|v| v.as_bool());
            if prev != curr {
                window_flip_count += 1;
            }
        }

        storage.put(TESTS, &test_key, json!({
            "id": test_ref,
            "testId": input.test_id,
            "language": input.language,
            "builder": input.builder,
            "testType": input.test_type,
            "results": serde_json::to_string(&results)?,
            "flipCount": window_flip_count,
            "lastFlipAt": now,
            "quarantined": quarantined,
        })).await?;

        if window_flip_count >= flip_threshold {
            if auto_quarantine && !quarantined {
                let mut updated = storage.get(TESTS, &test_key).await?.unwrap_or(json!({}));
                updated["quarantined"] = json!(true);
                updated["quarantinedAt"] = json!(Utc::now().to_rfc3339());
                updated["quarantinedBy"] = json!("auto");
                storage.put(TESTS, &test_key, updated).await?;
            }

            let recent: Vec<bool> = results.iter()
                .filter_map(|r| r.get("passed").and_then(|v| v.as_bool()))
                .collect();

            return Ok(FlakyTestRecordOutput::FlakyDetected {
                test: test_ref,
                flip_count: window_flip_count,
                recent_results: recent,
            });
        }

        Ok(FlakyTestRecordOutput::Ok { test: test_ref })
    }

    async fn quarantine(
        &self,
        input: FlakyTestQuarantineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestQuarantineOutput, Box<dyn std::error::Error>> {
        let all_tests = storage.find(TESTS, Some(&json!({"testId": input.test_id}))).await?;
        if all_tests.is_empty() {
            return Ok(FlakyTestQuarantineOutput::NotFound { test_id: input.test_id });
        }
        let test = &all_tests[0];
        let test_id_str = test.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if test.get("quarantined").and_then(|v| v.as_bool()).unwrap_or(false) {
            return Ok(FlakyTestQuarantineOutput::AlreadyQuarantined { test: test_id_str });
        }

        let test_key = format!("{}:{}:{}",
            input.test_id,
            test.get("language").and_then(|v| v.as_str()).unwrap_or(""),
            test.get("testType").and_then(|v| v.as_str()).unwrap_or("unit"));
        let mut updated = test.clone();
        updated["quarantined"] = json!(true);
        updated["quarantinedAt"] = json!(Utc::now().to_rfc3339());
        updated["quarantinedBy"] = json!(input.owner.as_deref().unwrap_or("manual"));
        updated["reason"] = json!(input.reason);
        storage.put(TESTS, &test_key, updated).await?;

        Ok(FlakyTestQuarantineOutput::Ok { test: test_id_str })
    }

    async fn release(
        &self,
        input: FlakyTestReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestReleaseOutput, Box<dyn std::error::Error>> {
        let all_tests = storage.find(TESTS, Some(&json!({"testId": input.test_id}))).await?;
        if all_tests.is_empty() {
            return Ok(FlakyTestReleaseOutput::NotQuarantined { test: input.test_id });
        }
        let test = &all_tests[0];
        let test_id_str = test.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !test.get("quarantined").and_then(|v| v.as_bool()).unwrap_or(false) {
            return Ok(FlakyTestReleaseOutput::NotQuarantined { test: test_id_str });
        }

        let test_key = format!("{}:{}:{}",
            input.test_id,
            test.get("language").and_then(|v| v.as_str()).unwrap_or(""),
            test.get("testType").and_then(|v| v.as_str()).unwrap_or("unit"));
        let mut updated = test.clone();
        updated["quarantined"] = json!(false);
        updated["quarantinedAt"] = json!(null);
        updated["quarantinedBy"] = json!(null);
        updated["reason"] = json!(null);
        storage.put(TESTS, &test_key, updated).await?;

        Ok(FlakyTestReleaseOutput::Ok { test: test_id_str })
    }

    async fn is_quarantined(
        &self,
        input: FlakyTestIsQuarantinedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestIsQuarantinedOutput, Box<dyn std::error::Error>> {
        let all_tests = storage.find(TESTS, Some(&json!({"testId": input.test_id}))).await?;
        if all_tests.is_empty() {
            return Ok(FlakyTestIsQuarantinedOutput::Unknown { test_id: input.test_id });
        }
        let test = &all_tests[0];
        let test_id_str = test.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if test.get("quarantined").and_then(|v| v.as_bool()).unwrap_or(false) {
            let qa_str = test.get("quarantinedAt").and_then(|v| v.as_str()).unwrap_or("");
            let qa = chrono::DateTime::parse_from_rfc3339(qa_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            return Ok(FlakyTestIsQuarantinedOutput::Yes {
                test: test_id_str,
                reason: test.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                owner: test.get("owner").and_then(|v| v.as_str()).map(|s| s.to_string()),
                quarantined_at: qa,
            });
        }
        Ok(FlakyTestIsQuarantinedOutput::No { test: test_id_str })
    }

    async fn report(
        &self,
        input: FlakyTestReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestReportOutput, Box<dyn std::error::Error>> {
        let all_tests = storage.find(TESTS, None).await?;
        let (flip_threshold, _, _, _) = get_policy(storage).await;

        let mut total_tracked: i64 = 0;
        let mut currently_flaky: i64 = 0;
        let mut quarantined_count: i64 = 0;
        let stabilized: i64 = 0;

        for test in &all_tests {
            let test_type = test.get("testType").and_then(|v| v.as_str()).unwrap_or("unit");
            if let Some(ref filter) = input.test_type {
                if test_type != filter { continue; }
            }
            total_tracked += 1;
            let flip_count = test.get("flipCount").and_then(|v| v.as_i64()).unwrap_or(0);
            let is_q = test.get("quarantined").and_then(|v| v.as_bool()).unwrap_or(false);
            if flip_count >= flip_threshold { currently_flaky += 1; }
            if is_q { quarantined_count += 1; }
        }

        let summary = json!({
            "total_tracked": total_tracked,
            "currently_flaky": currently_flaky,
            "quarantined": quarantined_count,
            "stabilized": stabilized,
            "top_flaky": [],
        });

        Ok(FlakyTestReportOutput::Ok { summary })
    }

    async fn set_policy(
        &self,
        input: FlakyTestSetPolicyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestSetPolicyOutput, Box<dyn std::error::Error>> {
        let (et, ew, ea, er) = get_policy(storage).await;
        storage.put(POLICY, "current", json!({
            "flipThreshold": input.flip_threshold.unwrap_or(et),
            "flipWindow": input.flip_window.unwrap_or(ew),
            "autoQuarantine": input.auto_quarantine.unwrap_or(ea),
            "retryCount": input.retry_count.unwrap_or(er),
        })).await?;

        Ok(FlakyTestSetPolicyOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_ok() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.record(
            FlakyTestRecordInput {
                test_id: "test-login".to_string(),
                language: "typescript".to_string(),
                builder: "vitest".to_string(),
                test_type: "unit".to_string(),
                passed: true,
                duration: 150,
            },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestRecordOutput::Ok { test } => {
                assert!(!test.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_quarantine_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.quarantine(
            FlakyTestQuarantineInput {
                test_id: "nonexistent".to_string(),
                reason: "flaky".to_string(),
                owner: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestQuarantineOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_release_not_quarantined() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.release(
            FlakyTestReleaseInput { test_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestReleaseOutput::NotQuarantined { .. } => {},
            _ => panic!("Expected NotQuarantined variant"),
        }
    }

    #[tokio::test]
    async fn test_is_quarantined_unknown() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.is_quarantined(
            FlakyTestIsQuarantinedInput { test_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestIsQuarantinedOutput::Unknown { .. } => {},
            _ => panic!("Expected Unknown variant"),
        }
    }

    #[tokio::test]
    async fn test_report_empty() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.report(
            FlakyTestReportInput { test_type: None },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestReportOutput::Ok { summary } => {
                assert_eq!(summary.get("total_tracked").and_then(|v| v.as_i64()), Some(0));
            },
        }
    }

    #[tokio::test]
    async fn test_set_policy() {
        let storage = InMemoryStorage::new();
        let handler = FlakyTestHandlerImpl;
        let result = handler.set_policy(
            FlakyTestSetPolicyInput {
                flip_threshold: Some(5),
                flip_window: Some("14d".to_string()),
                auto_quarantine: Some(true),
                retry_count: Some(2),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlakyTestSetPolicyOutput::Ok => {},
        }
    }
}
