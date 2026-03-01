// PerformanceProfile concept implementation
// Aggregate performance data per static entity. Supports timing percentiles,
// hotspot detection, slow chain analysis, and window comparisons.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PerformanceProfileHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("performance-profile-{}", id)
}

pub struct PerformanceProfileHandlerImpl;

/// Compute percentile from a sorted slice
fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() { return 0.0; }
    let idx = ((p / 100.0) * sorted.len() as f64).ceil() as usize;
    sorted[idx.max(1).min(sorted.len()) - 1]
}

#[async_trait]
impl PerformanceProfileHandler for PerformanceProfileHandlerImpl {
    async fn aggregate(
        &self,
        input: PerformanceProfileAggregateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileAggregateOutput, Box<dyn std::error::Error>> {
        let entries = storage.find("runtime-coverage", Some(&json!({ "symbol": input.symbol }))).await?;

        // Filter by window time range
        let window: serde_json::Value = serde_json::from_str(&input.window).unwrap_or(json!({}));
        let start = window["start"].as_str().unwrap_or("");
        let end = window["end"].as_str().unwrap_or("");

        let filtered: Vec<&serde_json::Value> = entries.iter().filter(|e| {
            if start.is_empty() && end.is_empty() { return true; }
            let ts = e["timestamp"].as_str()
                .or(e["lastExercised"].as_str())
                .unwrap_or("");
            if !start.is_empty() && ts < start { return false; }
            if !end.is_empty() && ts > end { return false; }
            true
        }).collect();

        if filtered.len() < 2 {
            return Ok(PerformanceProfileAggregateOutput::InsufficientData {
                count: filtered.len() as i64,
            });
        }

        let id = next_id();

        // Determine entity kind from symbol path
        let entity_kind = if input.symbol.contains("/action/") { "action" }
            else if input.symbol.contains("/sync/") { "sync" }
            else if input.symbol.contains("/widget/") { "widget" }
            else { "unknown" };

        let mut timings: Vec<f64> = filtered.iter()
            .map(|e| e["durationMs"].as_f64().unwrap_or(0.0))
            .collect();
        let error_count = filtered.iter()
            .filter(|e| {
                let status = e["status"].as_str().unwrap_or("");
                status == "error" || status == "failed"
            })
            .count();

        timings.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let error_rate = if !filtered.is_empty() {
            format!("{:.4}", error_count as f64 / filtered.len() as f64)
        } else {
            "0".to_string()
        };

        storage.put("performance-profile", &id, json!({
            "id": id,
            "entitySymbol": input.symbol,
            "entityKind": entity_kind,
            "sampleWindow": input.window,
            "invocationCount": filtered.len(),
            "timing": serde_json::to_string(&json!({
                "p50": percentile(&timings, 50.0),
                "p90": percentile(&timings, 90.0),
                "p99": percentile(&timings, 99.0),
                "min": timings.first().unwrap_or(&0.0),
                "max": timings.last().unwrap_or(&0.0)
            }))?,
            "errorRate": error_rate
        })).await?;

        Ok(PerformanceProfileAggregateOutput::Ok { profile: id })
    }

    async fn hotspots(
        &self,
        input: PerformanceProfileHotspotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileHotspotsOutput, Box<dyn std::error::Error>> {
        let all_profiles = storage.find("performance-profile", None).await?;
        let filtered: Vec<&serde_json::Value> = if input.kind.is_empty() {
            all_profiles.iter().collect()
        } else {
            all_profiles.iter().filter(|p| p["entityKind"].as_str().unwrap_or("") == input.kind).collect()
        };

        let mut scored: Vec<(String, f64)> = filtered.iter().map(|p| {
            let symbol = p["entitySymbol"].as_str().unwrap_or("").to_string();
            let value = if input.metric == "errorRate" {
                p["errorRate"].as_str().unwrap_or("0").parse().unwrap_or(0.0)
            } else {
                let timing: serde_json::Value = serde_json::from_str(
                    p["timing"].as_str().unwrap_or("{}")
                ).unwrap_or(json!({}));
                timing[&input.metric].as_f64().unwrap_or(0.0)
            };
            (symbol, value)
        }).collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let top_n = input.top_n.max(1) as usize;
        scored.truncate(top_n);

        let hotspots: Vec<serde_json::Value> = scored.iter()
            .map(|(sym, val)| json!({ "symbol": sym, "value": val }))
            .collect();

        Ok(PerformanceProfileHotspotsOutput::Ok {
            hotspots: serde_json::to_string(&hotspots)?,
        })
    }

    async fn slow_chains(
        &self,
        input: PerformanceProfileSlowChainsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileSlowChainsOutput, Box<dyn std::error::Error>> {
        let all_profiles = storage.find("performance-profile", None).await?;

        // Build symbol -> p90 map
        let mut profile_map = std::collections::HashMap::new();
        for p in &all_profiles {
            let symbol = p["entitySymbol"].as_str().unwrap_or("");
            let timing: serde_json::Value = serde_json::from_str(
                p["timing"].as_str().unwrap_or("{}")
            ).unwrap_or(json!({}));
            let p90 = timing["p90"].as_f64().unwrap_or(0.0);
            profile_map.insert(symbol.to_string(), p90);
        }

        // Find chains exceeding threshold
        let mut chains: Vec<serde_json::Value> = Vec::new();
        for p in &all_profiles {
            let symbol = p["entitySymbol"].as_str().unwrap_or("");
            let p90 = profile_map.get(symbol).copied().unwrap_or(0.0);
            if p90 > input.threshold_ms as f64 {
                chains.push(json!({
                    "flowGraphPath": symbol,
                    "p90TotalMs": p90,
                    "bottleneck": symbol
                }));
            }
        }

        chains.sort_by(|a, b| {
            b["p90TotalMs"].as_f64().unwrap_or(0.0)
                .partial_cmp(&a["p90TotalMs"].as_f64().unwrap_or(0.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(PerformanceProfileSlowChainsOutput::Ok {
            chains: serde_json::to_string(&chains)?,
        })
    }

    async fn compare_windows(
        &self,
        input: PerformanceProfileCompareWindowsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileCompareWindowsOutput, Box<dyn std::error::Error>> {
        let profiles = storage.find("performance-profile", Some(&json!({ "entitySymbol": input.symbol }))).await?;

        let data_a = profiles.iter().find(|p| p["sampleWindow"].as_str().unwrap_or("") == input.window_a);
        let data_b = profiles.iter().find(|p| p["sampleWindow"].as_str().unwrap_or("") == input.window_b);

        let data_a = match data_a {
            Some(d) => d,
            None => return Ok(PerformanceProfileCompareWindowsOutput::InsufficientData {
                window: input.window_a,
                count: 0,
            }),
        };
        let data_b = match data_b {
            Some(d) => d,
            None => return Ok(PerformanceProfileCompareWindowsOutput::InsufficientData {
                window: input.window_b,
                count: 0,
            }),
        };

        let timing_a: serde_json::Value = serde_json::from_str(data_a["timing"].as_str().unwrap_or("{}")).unwrap_or(json!({}));
        let timing_b: serde_json::Value = serde_json::from_str(data_b["timing"].as_str().unwrap_or("{}")).unwrap_or(json!({}));

        let a_p50 = timing_a["p50"].as_f64().unwrap_or(0.0);
        let b_p50 = timing_b["p50"].as_f64().unwrap_or(0.0);
        let a_p99 = timing_a["p99"].as_f64().unwrap_or(0.0);
        let b_p99 = timing_b["p99"].as_f64().unwrap_or(0.0);

        let pct_change = if a_p50 > 0.0 { (b_p50 - a_p50) / a_p50 * 100.0 } else { 0.0 };
        let regression = b_p50 > a_p50 * 1.1;

        Ok(PerformanceProfileCompareWindowsOutput::Ok {
            comparison: serde_json::to_string(&json!({
                "aP50": a_p50, "bP50": b_p50,
                "aP99": a_p99, "bP99": b_p99,
                "regression": regression,
                "pctChange": format!("{:.2}", pct_change)
            }))?,
        })
    }

    async fn get(
        &self,
        input: PerformanceProfileGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PerformanceProfileGetOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("performance-profile", &input.profile).await? {
            Some(r) => r,
            None => return Ok(PerformanceProfileGetOutput::Notfound),
        };

        Ok(PerformanceProfileGetOutput::Ok {
            profile: record["id"].as_str().unwrap_or("").to_string(),
            entity_symbol: record["entitySymbol"].as_str().unwrap_or("").to_string(),
            entity_kind: record["entityKind"].as_str().unwrap_or("").to_string(),
            invocation_count: record["invocationCount"].as_i64().unwrap_or(0),
            error_rate: record["errorRate"].as_str().unwrap_or("0").to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_aggregate_insufficient_data() {
        let storage = InMemoryStorage::new();
        let handler = PerformanceProfileHandlerImpl;
        let result = handler.aggregate(
            PerformanceProfileAggregateInput {
                symbol: "test/action/create".to_string(),
                window: r#"{"start":"","end":""}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PerformanceProfileAggregateOutput::InsufficientData { count } => {
                assert_eq!(count, 0);
            }
            _ => panic!("Expected InsufficientData variant"),
        }
    }

    #[tokio::test]
    async fn test_hotspots_empty() {
        let storage = InMemoryStorage::new();
        let handler = PerformanceProfileHandlerImpl;
        let result = handler.hotspots(
            PerformanceProfileHotspotsInput {
                kind: "".to_string(),
                metric: "p90".to_string(),
                top_n: 5,
            },
            &storage,
        ).await.unwrap();
        match result {
            PerformanceProfileHotspotsOutput::Ok { hotspots } => {
                assert_eq!(hotspots, "[]");
            }
        }
    }

    #[tokio::test]
    async fn test_slow_chains_empty() {
        let storage = InMemoryStorage::new();
        let handler = PerformanceProfileHandlerImpl;
        let result = handler.slow_chains(
            PerformanceProfileSlowChainsInput { threshold_ms: 100 },
            &storage,
        ).await.unwrap();
        match result {
            PerformanceProfileSlowChainsOutput::Ok { chains } => {
                assert_eq!(chains, "[]");
            }
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PerformanceProfileHandlerImpl;
        let result = handler.get(
            PerformanceProfileGetInput { profile: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PerformanceProfileGetOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_compare_windows_insufficient_data() {
        let storage = InMemoryStorage::new();
        let handler = PerformanceProfileHandlerImpl;
        let result = handler.compare_windows(
            PerformanceProfileCompareWindowsInput {
                symbol: "test".to_string(),
                window_a: "w1".to_string(),
                window_b: "w2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PerformanceProfileCompareWindowsOutput::InsufficientData { .. } => {}
            _ => panic!("Expected InsufficientData variant"),
        }
    }
}
