// Shell Handler Implementation
//
// Application shell with named zones, role assignment, and overlay stack
// management. Zones partition the shell layout; overlays stack on top as
// modal or temporary UI layers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ShellHandler;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

pub struct ShellHandlerImpl;

#[async_trait]
impl ShellHandler for ShellHandlerImpl {
    async fn initialize(
        &self,
        input: ShellInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellInitializeOutput, Box<dyn std::error::Error>> {
        let zone_list: Vec<String> = match serde_json::from_str(&input.zones) {
            Ok(v) => v,
            Err(_) => {
                return Ok(ShellInitializeOutput::Invalid {
                    message: "Zones must be a JSON array of zone names".to_string(),
                });
            }
        };

        if zone_list.is_empty() {
            return Ok(ShellInitializeOutput::Invalid {
                message: "At least one zone must be defined".to_string(),
            });
        }

        let id = if input.shell.is_empty() {
            next_id("S")
        } else {
            input.shell
        };

        // Initialize zones with empty refs, each zone gets a default role
        let mut zone_map: HashMap<String, String> = HashMap::new();
        let mut zone_role: HashMap<String, String> = HashMap::new();
        for zone in &zone_list {
            zone_map.insert(zone.clone(), String::new());
            zone_role.insert(zone.clone(), "content".to_string());
        }

        storage.put("shell", &id, json!({
            "zones": serde_json::to_string(&zone_map)?,
            "zoneRole": serde_json::to_string(&zone_role)?,
            "activeOverlays": "[]",
            "status": "initialized",
        })).await?;

        Ok(ShellInitializeOutput::Ok { shell: id })
    }

    async fn assign_to_zone(
        &self,
        input: ShellAssignToZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellAssignToZoneOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("shell", &input.shell).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(ShellAssignToZoneOutput::Notfound {
                    message: format!("Shell \"{}\" not found", input.shell),
                });
            }
        };

        let zones_str = existing["zones"].as_str().unwrap_or("{}");
        let mut zones: HashMap<String, String> = serde_json::from_str(zones_str)?;

        if !zones.contains_key(&input.zone) {
            return Ok(ShellAssignToZoneOutput::Notfound {
                message: format!("Zone \"{}\" not found in shell", input.zone),
            });
        }

        // Access the `ref` field via raw identifier
        zones.insert(input.zone.clone(), input.r#ref.clone());

        let mut updated = existing.clone();
        updated["zones"] = json!(serde_json::to_string(&zones)?);
        storage.put("shell", &input.shell, updated).await?;

        Ok(ShellAssignToZoneOutput::Ok {
            shell: input.shell,
        })
    }

    async fn clear_zone(
        &self,
        input: ShellClearZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellClearZoneOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("shell", &input.shell).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(ShellClearZoneOutput::Notfound {
                    message: format!("Shell \"{}\" not found", input.shell),
                });
            }
        };

        let zones_str = existing["zones"].as_str().unwrap_or("{}");
        let mut zones: HashMap<String, String> = serde_json::from_str(zones_str)?;

        if !zones.contains_key(&input.zone) {
            return Ok(ShellClearZoneOutput::Notfound {
                message: format!("Zone \"{}\" not found in shell", input.zone),
            });
        }

        let previous = zones.get(&input.zone).cloned().unwrap_or_default();
        zones.insert(input.zone.clone(), String::new());

        let mut updated = existing.clone();
        updated["zones"] = json!(serde_json::to_string(&zones)?);
        storage.put("shell", &input.shell, updated).await?;

        let previous_opt = if previous.is_empty() {
            None
        } else {
            Some(previous)
        };

        Ok(ShellClearZoneOutput::Ok {
            shell: input.shell,
            previous: previous_opt,
        })
    }

    async fn push_overlay(
        &self,
        input: ShellPushOverlayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellPushOverlayOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("shell", &input.shell).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(ShellPushOverlayOutput::Invalid {
                    message: format!("Shell \"{}\" not found", input.shell),
                });
            }
        };

        if input.r#ref.is_empty() {
            return Ok(ShellPushOverlayOutput::Invalid {
                message: "Overlay ref is required".to_string(),
            });
        }

        let overlays_str = existing["activeOverlays"].as_str().unwrap_or("[]");
        let mut overlays: Vec<String> = serde_json::from_str(overlays_str)?;
        overlays.push(input.r#ref.clone());

        let mut updated = existing.clone();
        updated["activeOverlays"] = json!(serde_json::to_string(&overlays)?);
        storage.put("shell", &input.shell, updated).await?;

        Ok(ShellPushOverlayOutput::Ok {
            shell: input.shell,
        })
    }

    async fn pop_overlay(
        &self,
        input: ShellPopOverlayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellPopOverlayOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("shell", &input.shell).await?;
        let existing = match existing {
            Some(v) => v,
            None => {
                return Ok(ShellPopOverlayOutput::Empty {
                    message: format!("Shell \"{}\" not found", input.shell),
                });
            }
        };

        let overlays_str = existing["activeOverlays"].as_str().unwrap_or("[]");
        let mut overlays: Vec<String> = serde_json::from_str(overlays_str)?;

        if overlays.is_empty() {
            return Ok(ShellPopOverlayOutput::Empty {
                message: "No active overlays to pop".to_string(),
            });
        }

        let overlay = overlays.pop().unwrap();

        let mut updated = existing.clone();
        updated["activeOverlays"] = json!(serde_json::to_string(&overlays)?);
        storage.put("shell", &input.shell, updated).await?;

        Ok(ShellPopOverlayOutput::Ok {
            shell: input.shell,
            overlay,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_success() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.initialize(
            ShellInitializeInput {
                shell: "".to_string(),
                zones: r#"["header","main","footer"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ShellInitializeOutput::Ok { shell } => {
                assert!(!shell.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_empty_zones() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.initialize(
            ShellInitializeInput { shell: "".to_string(), zones: "[]".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ShellInitializeOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_to_zone_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.assign_to_zone(
            ShellAssignToZoneInput {
                shell: "missing".to_string(),
                zone: "main".to_string(),
                r#ref: "widget-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ShellAssignToZoneOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_clear_zone_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.clear_zone(
            ShellClearZoneInput { shell: "missing".to_string(), zone: "main".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ShellClearZoneOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_push_overlay_invalid() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.push_overlay(
            ShellPushOverlayInput { shell: "missing".to_string(), r#ref: "overlay".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ShellPushOverlayOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_pop_overlay_empty() {
        let storage = InMemoryStorage::new();
        let handler = ShellHandlerImpl;
        let result = handler.pop_overlay(
            ShellPopOverlayInput { shell: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ShellPopOverlayOutput::Empty { .. } => {},
            _ => panic!("Expected Empty variant"),
        }
    }
}
