// Timer concept implementation
// Introduces time-based triggers into process execution: absolute dates,
// relative durations, and recurring cycles.
// Status lifecycle: active -> fired|cancelled; cycle timers remain active after fire.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TimerHandler;
use serde_json::json;

pub struct TimerHandlerImpl;

fn generate_timer_id() -> String {
    format!("tmr-{}", uuid::Uuid::new_v4())
}

/// Compute next fire time from specification string.
/// For simplicity, interprets specification as an ISO 8601 duration offset from now,
/// or as a fixed ISO 8601 datetime for date-type timers.
fn compute_next_fire(timer_type: &str, specification: &str) -> Result<String, String> {
    if specification.is_empty() {
        return Err("Empty specification".to_string());
    }
    // For duration/cycle timers, compute a future time offset.
    // For date timers, treat the specification as a fixed datetime.
    match timer_type {
        "date" => Ok(specification.to_string()),
        "duration" | "cycle" => {
            // Parse a simple duration like "PT30S", "PT5M", "PT1H"
            let now = chrono::Utc::now();
            let seconds = parse_duration_seconds(specification)
                .map_err(|e| format!("Invalid duration: {}", e))?;
            let next = now + chrono::Duration::seconds(seconds);
            Ok(next.to_rfc3339())
        }
        _ => Err(format!("Unknown timer type: {}", timer_type)),
    }
}

/// Parse a subset of ISO 8601 durations into seconds.
fn parse_duration_seconds(spec: &str) -> Result<i64, String> {
    if !spec.starts_with("PT") {
        return Err("Duration must start with PT".to_string());
    }
    let remainder = &spec[2..];
    let mut total_seconds: i64 = 0;
    let mut num_buf = String::new();

    for ch in remainder.chars() {
        if ch.is_ascii_digit() {
            num_buf.push(ch);
        } else {
            let val: i64 = num_buf.parse().map_err(|_| "Invalid number in duration")?;
            num_buf.clear();
            match ch {
                'H' => total_seconds += val * 3600,
                'M' => total_seconds += val * 60,
                'S' => total_seconds += val,
                _ => return Err(format!("Unknown duration unit: {}", ch)),
            }
        }
    }

    if total_seconds == 0 {
        return Err("Zero duration".to_string());
    }
    Ok(total_seconds)
}

#[async_trait]
impl TimerHandler for TimerHandlerImpl {
    async fn set_timer(
        &self,
        input: TimerSetTimerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerSetTimerOutput, Box<dyn std::error::Error>> {
        let next_fire_at = match compute_next_fire(&input.timer_type, &input.specification) {
            Ok(t) => t,
            Err(msg) => return Ok(TimerSetTimerOutput::InvalidSpec {
                specification: input.specification,
                message: msg,
            }),
        };

        let timer_id = generate_timer_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("timers", &timer_id, json!({
            "timer_id": timer_id,
            "run_ref": input.run_ref,
            "timer_type": input.timer_type,
            "specification": input.specification,
            "purpose_tag": input.purpose_tag,
            "context_ref": input.context_ref,
            "status": "active",
            "fire_count": 0,
            "next_fire_at": next_fire_at,
            "created_at": timestamp,
        })).await?;

        Ok(TimerSetTimerOutput::Ok {
            timer_id,
            run_ref: input.run_ref,
            next_fire_at,
        })
    }

    async fn fire(
        &self,
        input: TimerFireInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerFireOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("timers", &input.timer_id).await?;

        match existing {
            None => Ok(TimerFireOutput::NotFound {
                timer_id: input.timer_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "active" {
                    return Ok(TimerFireOutput::NotActive {
                        timer_id: input.timer_id,
                        current_status,
                    });
                }

                let run_ref = record["run_ref"].as_str().unwrap_or("").to_string();
                let purpose_tag = record["purpose_tag"].as_str().unwrap_or("").to_string();
                let context_ref = record["context_ref"].as_str().map(|s| s.to_string());
                let timer_type = record["timer_type"].as_str().unwrap_or("").to_string();
                let specification = record["specification"].as_str().unwrap_or("").to_string();
                let fire_count = record["fire_count"].as_i64().unwrap_or(0) + 1;

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("fire_count".to_string(), json!(fire_count));
                    obj.insert("last_fired_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));

                    if timer_type == "cycle" {
                        // Cycle timers remain active, compute next fire
                        if let Ok(next) = compute_next_fire(&timer_type, &specification) {
                            obj.insert("next_fire_at".to_string(), json!(next));
                        }
                    } else {
                        // date/duration timers transition to fired
                        obj.insert("status".to_string(), json!("fired"));
                        obj.insert("next_fire_at".to_string(), json!(null));
                    }
                }

                storage.put("timers", &input.timer_id, updated).await?;

                Ok(TimerFireOutput::Ok {
                    timer_id: input.timer_id,
                    run_ref,
                    purpose_tag,
                    context_ref,
                    fire_count,
                })
            }
        }
    }

    async fn cancel(
        &self,
        input: TimerCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerCancelOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("timers", &input.timer_id).await?;

        match existing {
            None => Ok(TimerCancelOutput::NotFound {
                timer_id: input.timer_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "active" {
                    return Ok(TimerCancelOutput::NotActive {
                        timer_id: input.timer_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("cancelled"));
                    obj.insert("cancelled_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("timers", &input.timer_id, updated).await?;

                Ok(TimerCancelOutput::Ok {
                    timer_id: input.timer_id,
                })
            }
        }
    }

    async fn reset(
        &self,
        input: TimerResetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TimerResetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("timers", &input.timer_id).await?;

        match existing {
            None => Ok(TimerResetOutput::NotFound {
                timer_id: input.timer_id,
            }),
            Some(record) => {
                let timer_type = record["timer_type"].as_str().unwrap_or("duration").to_string();
                let next_fire_at = compute_next_fire(&timer_type, &input.specification)
                    .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339());

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("specification".to_string(), json!(input.specification));
                    obj.insert("status".to_string(), json!("active"));
                    obj.insert("next_fire_at".to_string(), json!(next_fire_at));
                    obj.insert("reset_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("timers", &input.timer_id, updated).await?;

                Ok(TimerResetOutput::Ok {
                    timer_id: input.timer_id,
                    next_fire_at,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_timer_creates_active() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;
        let result = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-001".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT30S".to_string(),
                purpose_tag: "retry".to_string(),
                context_ref: Some("step-1".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            TimerSetTimerOutput::Ok { timer_id, run_ref, .. } => {
                assert!(timer_id.starts_with("tmr-"));
                assert_eq!(run_ref, "run-001");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_timer_invalid_spec() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;
        let result = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-002".to_string(),
                timer_type: "duration".to_string(),
                specification: "".to_string(),
                purpose_tag: "sla".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TimerSetTimerOutput::InvalidSpec { .. } => {}
            _ => panic!("Expected InvalidSpec variant"),
        }
    }

    #[tokio::test]
    async fn test_fire_duration_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-003".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT5M".to_string(),
                purpose_tag: "escalation".to_string(),
                context_ref: Some("approval-1".to_string()),
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.fire(
            TimerFireInput { timer_id: timer_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            TimerFireOutput::Ok { run_ref, purpose_tag, fire_count, .. } => {
                assert_eq!(run_ref, "run-003");
                assert_eq!(purpose_tag, "escalation");
                assert_eq!(fire_count, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fire_already_fired_returns_not_active() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-004".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT1H".to_string(),
                purpose_tag: "sla".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        handler.fire(TimerFireInput { timer_id: timer_id.clone() }, &storage).await.unwrap();

        let result = handler.fire(TimerFireInput { timer_id: timer_id.clone() }, &storage).await.unwrap();
        match result {
            TimerFireOutput::NotActive { current_status, .. } => {
                assert_eq!(current_status, "fired");
            }
            _ => panic!("Expected NotActive variant"),
        }
    }

    #[tokio::test]
    async fn test_cancel_active_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-005".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT10M".to_string(),
                purpose_tag: "reminder".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.cancel(TimerCancelInput { timer_id: timer_id.clone() }, &storage).await.unwrap();
        match result {
            TimerCancelOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reset_timer() {
        let storage = InMemoryStorage::new();
        let handler = TimerHandlerImpl;

        let set = handler.set_timer(
            TimerSetTimerInput {
                run_ref: "run-006".to_string(),
                timer_type: "duration".to_string(),
                specification: "PT5S".to_string(),
                purpose_tag: "retry".to_string(),
                context_ref: None,
            },
            &storage,
        ).await.unwrap();
        let timer_id = match set {
            TimerSetTimerOutput::Ok { timer_id, .. } => timer_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.reset(
            TimerResetInput { timer_id: timer_id.clone(), specification: "PT10M".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TimerResetOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }
}
