// CausalClock Handler Implementation
//
// Track happens-before ordering between events across distributed
// participants. Vector clocks provide the universal ordering
// primitive for OT delivery, CRDT consistency, DAG traversal,
// provenance chains, and temporal queries.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CausalClockHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("causal-clock-{}", id)
}

pub struct CausalClockHandlerImpl;

#[async_trait]
impl CausalClockHandler for CausalClockHandlerImpl {
    async fn tick(
        &self,
        input: CausalClockTickInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockTickOutput, Box<dyn std::error::Error>> {
        let replica_id = &input.replica_id;

        // Retrieve current clock or initialize
        let existing = storage.get("causal-clock", replica_id).await?;
        let mut clock: Vec<i64> = match &existing {
            Some(rec) => {
                rec["clock"].as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
                    .unwrap_or_default()
            }
            None => Vec::new(),
        };

        // Find the replica's index among all known replicas
        let all_replicas = storage.find("causal-clock-replica", json!({})).await?;
        let replica_index = all_replicas.iter()
            .position(|r| r["replicaId"].as_str() == Some(replica_id));

        let index = match replica_index {
            Some(idx) => idx,
            None => {
                let idx = all_replicas.len();
                storage.put("causal-clock-replica", replica_id, json!({
                    "replicaId": replica_id,
                    "index": idx,
                })).await?;
                idx
            }
        };

        // Ensure clock vector is large enough
        while clock.len() <= index {
            clock.push(0);
        }

        // Increment this replica's position
        clock[index] += 1;

        // Store updated clock
        storage.put("causal-clock", replica_id, json!({
            "replicaId": replica_id,
            "clock": clock,
        })).await?;

        // Create event record
        let event_id = next_id();
        storage.put("causal-clock-event", &event_id, json!({
            "id": event_id,
            "replicaId": replica_id,
            "clock": clock,
        })).await?;

        Ok(CausalClockTickOutput::Ok {
            timestamp: event_id,
            clock,
        })
    }

    async fn merge(
        &self,
        input: CausalClockMergeInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<CausalClockMergeOutput, Box<dyn std::error::Error>> {
        let local_clock = &input.local_clock;
        let remote_clock = &input.remote_clock;

        if local_clock.len() != remote_clock.len() {
            return Ok(CausalClockMergeOutput::Incompatible {
                message: format!(
                    "Clock dimensions differ: local={}, remote={}",
                    local_clock.len(),
                    remote_clock.len()
                ),
            });
        }

        // Component-wise maximum
        let merged: Vec<i64> = local_clock.iter()
            .zip(remote_clock.iter())
            .map(|(a, b)| (*a).max(*b))
            .collect();

        Ok(CausalClockMergeOutput::Ok { merged })
    }

    async fn compare(
        &self,
        input: CausalClockCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockCompareOutput, Box<dyn std::error::Error>> {
        let event_a = storage.get("causal-clock-event", &input.a).await?;
        if event_a.is_none() {
            return Ok(CausalClockCompareOutput::Concurrent);
        }

        let event_b = storage.get("causal-clock-event", &input.b).await?;
        if event_b.is_none() {
            return Ok(CausalClockCompareOutput::Concurrent);
        }

        let event_a = event_a.unwrap();
        let event_b = event_b.unwrap();

        let clock_a: Vec<i64> = event_a["clock"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
            .unwrap_or_default();
        let clock_b: Vec<i64> = event_b["clock"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
            .unwrap_or_default();

        // Normalize lengths
        let max_len = clock_a.len().max(clock_b.len());
        let norm_a: Vec<i64> = (0..max_len).map(|i| *clock_a.get(i).unwrap_or(&0)).collect();
        let norm_b: Vec<i64> = (0..max_len).map(|i| *clock_b.get(i).unwrap_or(&0)).collect();

        let mut a_less_or_equal = true;
        let mut b_less_or_equal = true;
        let mut equal = true;

        for i in 0..max_len {
            if norm_a[i] > norm_b[i] {
                b_less_or_equal = false;
                equal = false;
            }
            if norm_b[i] > norm_a[i] {
                a_less_or_equal = false;
                equal = false;
            }
        }

        if equal {
            return Ok(CausalClockCompareOutput::Concurrent);
        }
        if a_less_or_equal {
            return Ok(CausalClockCompareOutput::Before);
        }
        if b_less_or_equal {
            return Ok(CausalClockCompareOutput::After);
        }

        Ok(CausalClockCompareOutput::Concurrent)
    }

    async fn dominates(
        &self,
        input: CausalClockDominatesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CausalClockDominatesOutput, Box<dyn std::error::Error>> {
        let event_a = storage.get("causal-clock-event", &input.a).await?;
        if event_a.is_none() {
            return Ok(CausalClockDominatesOutput::Ok { result: false });
        }

        let event_b = storage.get("causal-clock-event", &input.b).await?;
        if event_b.is_none() {
            return Ok(CausalClockDominatesOutput::Ok { result: false });
        }

        let event_a = event_a.unwrap();
        let event_b = event_b.unwrap();

        let clock_a: Vec<i64> = event_a["clock"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
            .unwrap_or_default();
        let clock_b: Vec<i64> = event_b["clock"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
            .unwrap_or_default();

        let max_len = clock_a.len().max(clock_b.len());
        let norm_a: Vec<i64> = (0..max_len).map(|i| *clock_a.get(i).unwrap_or(&0)).collect();
        let norm_b: Vec<i64> = (0..max_len).map(|i| *clock_b.get(i).unwrap_or(&0)).collect();

        // a dominates b: a[i] >= b[i] for all i, and a != b
        let mut all_greater_or_equal = true;
        let mut strictly_greater = false;

        for i in 0..max_len {
            if norm_a[i] < norm_b[i] {
                all_greater_or_equal = false;
                break;
            }
            if norm_a[i] > norm_b[i] {
                strictly_greater = true;
            }
        }

        Ok(CausalClockDominatesOutput::Ok {
            result: all_greater_or_equal && strictly_greater,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_tick_creates_event() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        let result = handler.tick(
            CausalClockTickInput { replica_id: "replica-a".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockTickOutput::Ok { timestamp, clock } => {
                assert!(!timestamp.is_empty());
                assert!(!clock.is_empty());
                assert!(clock[0] >= 1);
            }
        }
    }

    #[tokio::test]
    async fn test_tick_increments_clock() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        handler.tick(
            CausalClockTickInput { replica_id: "replica-b".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.tick(
            CausalClockTickInput { replica_id: "replica-b".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockTickOutput::Ok { clock, .. } => {
                // After two ticks, the replica's position should be >= 2
                assert!(clock.iter().any(|&v| v >= 2));
            }
        }
    }

    #[tokio::test]
    async fn test_merge_same_dimension_clocks() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        let result = handler.merge(
            CausalClockMergeInput {
                local_clock: vec![3, 1, 2],
                remote_clock: vec![1, 4, 1],
            },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockMergeOutput::Ok { merged } => {
                assert_eq!(merged, vec![3, 4, 2]);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_incompatible_dimensions() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        let result = handler.merge(
            CausalClockMergeInput {
                local_clock: vec![1, 2],
                remote_clock: vec![1, 2, 3],
            },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockMergeOutput::Incompatible { message } => {
                assert!(message.contains("dimensions differ"));
            }
            _ => panic!("Expected Incompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_compare_concurrent_when_events_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        let result = handler.compare(
            CausalClockCompareInput {
                a: "missing-a".to_string(),
                b: "missing-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockCompareOutput::Concurrent => {}
            _ => panic!("Expected Concurrent variant"),
        }
    }

    #[tokio::test]
    async fn test_dominates_false_when_events_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CausalClockHandlerImpl;
        let result = handler.dominates(
            CausalClockDominatesInput {
                a: "missing-a".to_string(),
                b: "missing-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CausalClockDominatesOutput::Ok { result } => {
                assert!(!result);
            }
        }
    }
}
