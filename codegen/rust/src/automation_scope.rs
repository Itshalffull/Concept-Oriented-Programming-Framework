// AutomationScope Concept Implementation (Rust)
//
// Automation providers suite — manages scoping rules that control which
// automation actions are permitted or denied. Supports allowlist and
// denylist modes with glob-pattern matching on action references.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Configure ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigureInput {
    pub scope: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConfigureOutput {
    #[serde(rename = "ok")]
    Ok { scope: String },
    #[serde(rename = "invalid_mode")]
    InvalidMode { mode: String },
}

// ── AddRule ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AddRuleInput {
    pub scope: String,
    pub action_pattern: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AddRuleOutput {
    #[serde(rename = "ok")]
    Ok { scope: String, rule_count: u32 },
    #[serde(rename = "not_configured")]
    NotConfigured { scope: String },
}

// ── RemoveRule ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoveRuleInput {
    pub scope: String,
    pub action_pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RemoveRuleOutput {
    #[serde(rename = "ok")]
    Ok { scope: String, rule_count: u32 },
    #[serde(rename = "notfound")]
    NotFound { action_pattern: String },
}

// ── Check ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckInput {
    pub scope: String,
    pub action_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CheckOutput {
    #[serde(rename = "permitted")]
    Permitted { scope: String, action_ref: String },
    #[serde(rename = "denied")]
    Denied {
        scope: String,
        action_ref: String,
        reason: String,
    },
}

// ── ListRules ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ListRulesInput {
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ListRulesOutput {
    #[serde(rename = "ok")]
    Ok { rules: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct AutomationScopeHandler {
    counter: AtomicU64,
}

impl AutomationScopeHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    /// Simple glob match: supports `*` as a wildcard for any sequence of characters.
    fn glob_match(pattern: &str, value: &str) -> bool {
        let parts: Vec<&str> = pattern.split('*').collect();

        if parts.len() == 1 {
            // No wildcard — exact match
            return pattern == value;
        }

        let mut pos = 0;
        for (i, part) in parts.iter().enumerate() {
            if part.is_empty() {
                continue;
            }
            match value[pos..].find(part) {
                Some(idx) => {
                    if i == 0 && idx != 0 {
                        // First segment must match from the start
                        return false;
                    }
                    pos += idx + part.len();
                }
                None => return false,
            }
        }

        // If pattern does not end with *, the value must end exactly
        if !pattern.ends_with('*') && pos != value.len() {
            return false;
        }

        true
    }

    pub async fn configure(
        &self,
        input: ConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConfigureOutput> {
        if input.mode != "allowlist" && input.mode != "denylist" {
            return Ok(ConfigureOutput::InvalidMode { mode: input.mode });
        }

        storage
            .put(
                "automation_scope",
                &input.scope,
                json!({
                    "scope": input.scope,
                    "mode": input.mode,
                }),
            )
            .await?;

        Ok(ConfigureOutput::Ok {
            scope: input.scope,
        })
    }

    pub async fn add_rule(
        &self,
        input: AddRuleInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddRuleOutput> {
        let scope_rec = storage.get("automation_scope", &input.scope).await?;
        if scope_rec.is_none() {
            return Ok(AddRuleOutput::NotConfigured {
                scope: input.scope,
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let rule_key = format!("{}:{}", input.scope, id);

        storage
            .put(
                "scope_rule",
                &rule_key,
                json!({
                    "scope": input.scope,
                    "actionPattern": input.action_pattern,
                    "category": input.category,
                }),
            )
            .await?;

        // Count total rules for this scope
        let all_rules = storage
            .find("scope_rule", Some(&json!({ "scope": input.scope })))
            .await?;

        Ok(AddRuleOutput::Ok {
            scope: input.scope,
            rule_count: all_rules.len() as u32,
        })
    }

    pub async fn remove_rule(
        &self,
        input: RemoveRuleInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveRuleOutput> {
        let all_rules = storage
            .find(
                "scope_rule",
                Some(&json!({
                    "scope": input.scope,
                    "actionPattern": input.action_pattern,
                })),
            )
            .await?;

        if all_rules.is_empty() {
            return Ok(RemoveRuleOutput::NotFound {
                action_pattern: input.action_pattern,
            });
        }

        // Remove matching rules
        storage
            .del_many(
                "scope_rule",
                &json!({
                    "scope": input.scope,
                    "actionPattern": input.action_pattern,
                }),
            )
            .await?;

        // Count remaining rules
        let remaining = storage
            .find("scope_rule", Some(&json!({ "scope": input.scope })))
            .await?;

        Ok(RemoveRuleOutput::Ok {
            scope: input.scope,
            rule_count: remaining.len() as u32,
        })
    }

    pub async fn check(
        &self,
        input: CheckInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CheckOutput> {
        let scope_rec = storage.get("automation_scope", &input.scope).await?;

        let mode = match scope_rec {
            Some(rec) => rec["mode"].as_str().unwrap_or("denylist").to_string(),
            None => {
                // No scope configured: permit by default
                return Ok(CheckOutput::Permitted {
                    scope: input.scope,
                    action_ref: input.action_ref,
                });
            }
        };

        let rules = storage
            .find("scope_rule", Some(&json!({ "scope": input.scope })))
            .await?;

        let matches_any = rules.iter().any(|rule| {
            let pattern = rule["actionPattern"].as_str().unwrap_or("");
            Self::glob_match(pattern, &input.action_ref)
        });

        if mode == "allowlist" {
            if matches_any {
                Ok(CheckOutput::Permitted {
                    scope: input.scope,
                    action_ref: input.action_ref,
                })
            } else {
                Ok(CheckOutput::Denied {
                    scope: input.scope.clone(),
                    action_ref: input.action_ref,
                    reason: format!("not in allowlist for scope '{}'", input.scope),
                })
            }
        } else {
            // denylist
            if matches_any {
                Ok(CheckOutput::Denied {
                    scope: input.scope.clone(),
                    action_ref: input.action_ref,
                    reason: format!("blocked by denylist for scope '{}'", input.scope),
                })
            } else {
                Ok(CheckOutput::Permitted {
                    scope: input.scope,
                    action_ref: input.action_ref,
                })
            }
        }
    }

    pub async fn list_rules(
        &self,
        input: ListRulesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListRulesOutput> {
        let rules = storage
            .find("scope_rule", Some(&json!({ "scope": input.scope })))
            .await?;
        let rules_json = serde_json::to_string(&rules)?;
        Ok(ListRulesOutput::Ok { rules: rules_json })
    }
}

// ── Tests ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn configure_creates_allowlist_scope() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        let result = handler
            .configure(
                ConfigureInput {
                    scope: "ci".into(),
                    mode: "allowlist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConfigureOutput::Ok { scope } => assert_eq!(scope, "ci"),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn configure_rejects_invalid_mode() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        let result = handler
            .configure(
                ConfigureInput {
                    scope: "ci".into(),
                    mode: "blocklist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ConfigureOutput::InvalidMode { mode } => assert_eq!(mode, "blocklist"),
            _ => panic!("expected InvalidMode variant"),
        }
    }

    #[tokio::test]
    async fn add_rule_increments_count() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "prod".into(),
                    mode: "denylist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let r1 = handler
            .add_rule(
                AddRuleInput {
                    scope: "prod".into(),
                    action_pattern: "deploy.*".into(),
                    category: "deploy".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match r1 {
            AddRuleOutput::Ok { rule_count, .. } => assert_eq!(rule_count, 1),
            _ => panic!("expected Ok variant"),
        }

        let r2 = handler
            .add_rule(
                AddRuleInput {
                    scope: "prod".into(),
                    action_pattern: "delete.*".into(),
                    category: "destructive".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match r2 {
            AddRuleOutput::Ok { rule_count, .. } => assert_eq!(rule_count, 2),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn add_rule_returns_not_configured_for_unknown_scope() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        let result = handler
            .add_rule(
                AddRuleInput {
                    scope: "unknown".into(),
                    action_pattern: "build.*".into(),
                    category: "build".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddRuleOutput::NotConfigured { .. }));
    }

    #[tokio::test]
    async fn check_allowlist_permits_matching_action() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "ci".into(),
                    mode: "allowlist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "ci".into(),
                    action_pattern: "build.*".into(),
                    category: "build".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check(
                CheckInput {
                    scope: "ci".into(),
                    action_ref: "build.compile".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, CheckOutput::Permitted { .. }));
    }

    #[tokio::test]
    async fn check_allowlist_denies_non_matching_action() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "ci".into(),
                    mode: "allowlist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "ci".into(),
                    action_pattern: "build.*".into(),
                    category: "build".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check(
                CheckInput {
                    scope: "ci".into(),
                    action_ref: "deploy.production".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, CheckOutput::Denied { .. }));
    }

    #[tokio::test]
    async fn check_denylist_blocks_matching_action() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "prod".into(),
                    mode: "denylist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "prod".into(),
                    action_pattern: "delete.*".into(),
                    category: "destructive".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check(
                CheckInput {
                    scope: "prod".into(),
                    action_ref: "delete.user".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, CheckOutput::Denied { .. }));
    }

    #[tokio::test]
    async fn remove_rule_decrements_count() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "dev".into(),
                    mode: "denylist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "dev".into(),
                    action_pattern: "deploy.*".into(),
                    category: "deploy".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "dev".into(),
                    action_pattern: "delete.*".into(),
                    category: "destructive".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_rule(
                RemoveRuleInput {
                    scope: "dev".into(),
                    action_pattern: "deploy.*".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            RemoveRuleOutput::Ok { rule_count, .. } => assert_eq!(rule_count, 1),
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn remove_rule_returns_notfound_for_missing_pattern() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        let result = handler
            .remove_rule(
                RemoveRuleInput {
                    scope: "dev".into(),
                    action_pattern: "nonexistent.*".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveRuleOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn list_rules_returns_scope_rules_as_json() {
        let storage = InMemoryStorage::new();
        let handler = AutomationScopeHandler::new();

        handler
            .configure(
                ConfigureInput {
                    scope: "test".into(),
                    mode: "allowlist".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_rule(
                AddRuleInput {
                    scope: "test".into(),
                    action_pattern: "build.*".into(),
                    category: "build".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .list_rules(ListRulesInput { scope: "test".into() }, &storage)
            .await
            .unwrap();

        match result {
            ListRulesOutput::Ok { rules } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&rules).unwrap();
                assert_eq!(parsed.len(), 1);
                assert_eq!(
                    parsed[0]["actionPattern"].as_str().unwrap(),
                    "build.*"
                );
            }
        }
    }

    #[test]
    fn glob_match_exact() {
        assert!(AutomationScopeHandler::glob_match("build.compile", "build.compile"));
        assert!(!AutomationScopeHandler::glob_match("build.compile", "build.link"));
    }

    #[test]
    fn glob_match_wildcard() {
        assert!(AutomationScopeHandler::glob_match("build.*", "build.compile"));
        assert!(AutomationScopeHandler::glob_match("build.*", "build.link"));
        assert!(!AutomationScopeHandler::glob_match("build.*", "deploy.prod"));
    }

    #[test]
    fn glob_match_prefix_wildcard() {
        assert!(AutomationScopeHandler::glob_match("*.compile", "build.compile"));
        assert!(!AutomationScopeHandler::glob_match("*.compile", "build.link"));
    }
}
