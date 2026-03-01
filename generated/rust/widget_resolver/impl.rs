// WidgetResolver Handler Implementation
//
// Scores and selects the best widget for a given interface element based on
// context, affordance matching, scoring weights, and manual overrides.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetResolverHandler;
use serde_json::json;

pub struct WidgetResolverHandlerImpl;

/// Default scoring weights for widget resolution.
fn default_weights() -> serde_json::Value {
    json!({
        "specificity": 0.4,
        "conditionMatch": 0.3,
        "popularity": 0.2,
        "recency": 0.1
    })
}

#[async_trait]
impl WidgetResolverHandler for WidgetResolverHandlerImpl {
    async fn resolve(
        &self,
        input: WidgetResolverResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverResolveOutput, Box<dyn std::error::Error>> {
        let resolver = &input.resolver;
        let element = &input.element;
        let context = &input.context;

        let parsed_context: serde_json::Value = serde_json::from_str(context).unwrap_or(json!({}));

        // Load resolver record for overrides and weights
        let resolver_record = storage.get("resolver", resolver).await?;
        let overrides: serde_json::Value = if !resolver_record.is_null() {
            let ov_str = resolver_record.get("overrides")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            serde_json::from_str(ov_str).unwrap_or(json!({}))
        } else {
            json!({})
        };

        let weights: serde_json::Value = if !resolver_record.is_null() {
            let w_str = resolver_record.get("scoringWeights")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            let parsed: serde_json::Value = serde_json::from_str(w_str).unwrap_or(json!({}));
            if parsed.as_object().map_or(true, |o| o.is_empty()) {
                default_weights()
            } else {
                parsed
            }
        } else {
            default_weights()
        };

        // Check for manual override first
        if let Some(override_widget) = overrides.get(element).and_then(|v| v.as_str()) {
            return Ok(WidgetResolverResolveOutput::Ok {
                resolver: resolver.clone(),
                widget: override_widget.to_string(),
                score: 1.0,
                reason: "Manual override applied".to_string(),
            });
        }

        // Look up affordances for the element type
        let affordance_results = storage.find("affordance", json!(element)).await?;
        let affordances = affordance_results.as_array().cloned().unwrap_or_default();

        if affordances.is_empty() {
            return Ok(WidgetResolverResolveOutput::None {
                resolver: resolver.clone(),
                element: element.clone(),
            });
        }

        let specificity_weight = weights.get("specificity").and_then(|v| v.as_f64()).unwrap_or(0.4);
        let condition_match_weight = weights.get("conditionMatch").and_then(|v| v.as_f64()).unwrap_or(0.3);

        // Score each candidate widget
        let mut candidates: Vec<(String, f64, String)> = Vec::new();

        for aff in &affordances {
            let conditions: serde_json::Value = if let Some(cond_str) = aff.get("conditions").and_then(|v| v.as_str()) {
                serde_json::from_str(cond_str).unwrap_or(json!({}))
            } else {
                json!({})
            };

            let specificity = aff.get("specificity").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let mut score = (specificity / 100.0) * specificity_weight;

            // Condition match score
            let mut condition_matches = 0u32;
            let mut condition_total = 0u32;
            if let Some(cond_obj) = conditions.as_object() {
                for (key, value) in cond_obj {
                    if !value.is_null() {
                        condition_total += 1;
                        if let Some(ctx_val) = parsed_context.get(key) {
                            if ctx_val == value {
                                condition_matches += 1;
                            }
                        }
                    }
                }
            }

            if condition_total > 0 {
                score += (condition_matches as f64 / condition_total as f64) * condition_match_weight;
            } else {
                score += condition_match_weight;
            }

            let widget = aff.get("widget").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let reason = format!(
                "specificity={}, conditionMatch={}/{}",
                specificity, condition_matches, condition_total
            );

            // Round to 3 decimal places
            let score_rounded = (score * 1000.0).round() / 1000.0;
            candidates.push((widget, score_rounded, reason));
        }

        // Sort by score descending
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        if candidates.len() == 1 || candidates[0].1 > candidates[1].1 {
            return Ok(WidgetResolverResolveOutput::Ok {
                resolver: resolver.clone(),
                widget: candidates[0].0.clone(),
                score: candidates[0].1,
                reason: candidates[0].2.clone(),
            });
        }

        // Ambiguous: multiple candidates tied at top score
        let candidates_json: Vec<serde_json::Value> = candidates.iter().map(|(w, s, r)| {
            json!({ "widget": w, "score": s, "reason": r })
        }).collect();

        Ok(WidgetResolverResolveOutput::Ambiguous {
            resolver: resolver.clone(),
            candidates: serde_json::to_string(&candidates_json)?,
        })
    }

    async fn resolve_all(
        &self,
        input: WidgetResolverResolveAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverResolveAllOutput, Box<dyn std::error::Error>> {
        let resolver = &input.resolver;
        let elements_str = &input.elements;
        let context = &input.context;

        let parsed_elements: Vec<String> = serde_json::from_str(elements_str).unwrap_or_default();
        let mut resolved = Vec::new();
        let mut unresolved = Vec::new();

        for element in &parsed_elements {
            let result = self.resolve(
                WidgetResolverResolveInput {
                    resolver: resolver.clone(),
                    element: element.clone(),
                    context: context.clone(),
                },
                storage,
            ).await?;

            match result {
                WidgetResolverResolveOutput::Ok { widget, score, .. } => {
                    resolved.push(json!({
                        "element": element,
                        "widget": widget,
                        "score": score
                    }));
                }
                _ => {
                    unresolved.push(element.clone());
                }
            }
        }

        if unresolved.is_empty() {
            Ok(WidgetResolverResolveAllOutput::Ok {
                resolver: resolver.clone(),
                resolutions: serde_json::to_string(&resolved)?,
            })
        } else {
            Ok(WidgetResolverResolveAllOutput::Partial {
                resolver: resolver.clone(),
                resolved: serde_json::to_string(&resolved)?,
                unresolved: serde_json::to_string(&unresolved)?,
            })
        }
    }

    async fn r#override(
        &self,
        input: WidgetResolverOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverOverrideOutput, Box<dyn std::error::Error>> {
        let resolver = &input.resolver;
        let element = &input.element;
        let widget = &input.widget;

        if element.is_empty() || widget.is_empty() {
            return Ok(WidgetResolverOverrideOutput::Invalid {
                message: "Both element and widget are required for override".to_string(),
            });
        }

        let resolver_record = storage.get("resolver", resolver).await?;
        let mut overrides: serde_json::Value = if !resolver_record.is_null() {
            let ov_str = resolver_record.get("overrides")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            serde_json::from_str(ov_str).unwrap_or(json!({}))
        } else {
            json!({})
        };

        if let Some(obj) = overrides.as_object_mut() {
            obj.insert(element.clone(), json!(widget));
        }

        let default_context = if !resolver_record.is_null() {
            resolver_record.get("defaultContext")
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string()
        } else {
            "{}".to_string()
        };

        let scoring_weights = if !resolver_record.is_null() {
            resolver_record.get("scoringWeights")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            String::new()
        };

        let scoring_weights = if scoring_weights.is_empty() {
            serde_json::to_string(&default_weights())?
        } else {
            scoring_weights
        };

        storage.put("resolver", resolver, json!({
            "resolver": resolver,
            "overrides": serde_json::to_string(&overrides)?,
            "defaultContext": default_context,
            "scoringWeights": scoring_weights
        })).await?;

        Ok(WidgetResolverOverrideOutput::Ok {
            resolver: resolver.clone(),
        })
    }

    async fn set_weights(
        &self,
        input: WidgetResolverSetWeightsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverSetWeightsOutput, Box<dyn std::error::Error>> {
        let resolver = &input.resolver;
        let weights_str = &input.weights;

        let parsed_weights: serde_json::Value = match serde_json::from_str(weights_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(WidgetResolverSetWeightsOutput::Invalid {
                    message: "Weights must be valid JSON".to_string(),
                });
            }
        };

        // Validate weights sum roughly to 1.0
        let sum: f64 = parsed_weights.as_object()
            .map(|obj| obj.values().filter_map(|v| v.as_f64()).sum())
            .unwrap_or(0.0);

        if (sum - 1.0).abs() > 0.01 {
            return Ok(WidgetResolverSetWeightsOutput::Invalid {
                message: format!("Weights must sum to 1.0, got {}", sum),
            });
        }

        let resolver_record = storage.get("resolver", resolver).await?;

        let overrides = if !resolver_record.is_null() {
            resolver_record.get("overrides")
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string()
        } else {
            "{}".to_string()
        };

        let default_context = if !resolver_record.is_null() {
            resolver_record.get("defaultContext")
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string()
        } else {
            "{}".to_string()
        };

        storage.put("resolver", resolver, json!({
            "resolver": resolver,
            "overrides": overrides,
            "defaultContext": default_context,
            "scoringWeights": serde_json::to_string(&parsed_weights)?
        })).await?;

        Ok(WidgetResolverSetWeightsOutput::Ok {
            resolver: resolver.clone(),
        })
    }

    async fn explain(
        &self,
        input: WidgetResolverExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetResolverExplainOutput, Box<dyn std::error::Error>> {
        let resolver = &input.resolver;
        let element = &input.element;
        let context = &input.context;

        let resolver_record = storage.get("resolver", resolver).await?;
        if resolver_record.is_null() {
            return Ok(WidgetResolverExplainOutput::Notfound {
                message: format!("Resolver \"{}\" not found", resolver),
            });
        }

        let overrides: serde_json::Value = {
            let ov_str = resolver_record.get("overrides")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            serde_json::from_str(ov_str).unwrap_or(json!({}))
        };

        let weights: serde_json::Value = {
            let w_str = resolver_record.get("scoringWeights")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            serde_json::from_str(w_str).unwrap_or(json!({}))
        };

        let mut steps: Vec<String> = Vec::new();

        // Check override
        if let Some(override_widget) = overrides.get(element).and_then(|v| v.as_str()) {
            steps.push(format!("Override found: element \"{}\" -> widget \"{}\"", element, override_widget));
            steps.push("Resolution short-circuited by manual override".to_string());
        } else {
            steps.push(format!("No override for element \"{}\"", element));
            steps.push(format!("Scoring weights: {}", serde_json::to_string(&weights)?));

            let affordance_results = storage.find("affordance", json!(element)).await?;
            let affordances = affordance_results.as_array().cloned().unwrap_or_default();

            steps.push(format!("Found {} candidate affordance(s)", affordances.len()));

            for aff in &affordances {
                let widget = aff.get("widget").and_then(|v| v.as_str()).unwrap_or("");
                let specificity = aff.get("specificity").and_then(|v| v.as_f64()).unwrap_or(0.0);
                steps.push(format!("  - widget=\"{}\", specificity={}", widget, specificity));
            }
        }

        let parsed_context: serde_json::Value = serde_json::from_str(context).unwrap_or(json!({}));

        Ok(WidgetResolverExplainOutput::Ok {
            resolver: resolver.clone(),
            explanation: serde_json::to_string(&json!({
                "element": element,
                "context": parsed_context,
                "steps": steps
            }))?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_resolve_no_affordances() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        let result = handler.resolve(
            WidgetResolverResolveInput {
                resolver: "r1".to_string(),
                element: "button".to_string(),
                context: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverResolveOutput::None { element, .. } => {
                assert_eq!(element, "button");
            },
            _ => panic!("Expected None variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_with_override() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        // Set up an override
        handler.r#override(
            WidgetResolverOverrideInput {
                resolver: "r1".to_string(),
                element: "button".to_string(),
                widget: "FancyButton".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.resolve(
            WidgetResolverResolveInput {
                resolver: "r1".to_string(),
                element: "button".to_string(),
                context: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverResolveOutput::Ok { widget, score, reason, .. } => {
                assert_eq!(widget, "FancyButton");
                assert_eq!(score, 1.0);
                assert!(reason.contains("override"));
            },
            _ => panic!("Expected Ok variant with override"),
        }
    }

    #[tokio::test]
    async fn test_override_invalid_empty() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        let result = handler.r#override(
            WidgetResolverOverrideInput {
                resolver: "r1".to_string(),
                element: "".to_string(),
                widget: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverOverrideOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_set_weights_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        let result = handler.set_weights(
            WidgetResolverSetWeightsInput {
                resolver: "r1".to_string(),
                weights: r#"{"specificity":0.5,"conditionMatch":0.3,"popularity":0.1,"recency":0.1}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverSetWeightsOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_weights_invalid_sum() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        let result = handler.set_weights(
            WidgetResolverSetWeightsInput {
                resolver: "r1".to_string(),
                weights: r#"{"specificity":0.5,"conditionMatch":0.5,"popularity":0.5}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverSetWeightsOutput::Invalid { message } => {
                assert!(message.contains("sum"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_explain_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetResolverHandlerImpl;
        let result = handler.explain(
            WidgetResolverExplainInput {
                resolver: "nonexistent".to_string(),
                element: "button".to_string(),
                context: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetResolverExplainOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
