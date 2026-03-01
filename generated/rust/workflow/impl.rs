// Workflow Handler Implementation
//
// Finite state machines with named states and guarded transitions for
// content lifecycle management. Supports defining states with flags
// (e.g., "initial", "final"), defining labeled transitions between states,
// transitioning entities, and querying current state.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WorkflowHandler;
use serde_json::json;

pub struct WorkflowHandlerImpl;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct WorkflowState {
    name: String,
    flags: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct WorkflowTransition {
    from: String,
    to: String,
    label: String,
    guard: String,
}

#[async_trait]
impl WorkflowHandler for WorkflowHandlerImpl {
    async fn define_state(
        &self,
        input: WorkflowDefineStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowDefineStateOutput, Box<dyn std::error::Error>> {
        let wf_record = storage.get("workflow", &input.workflow).await?;

        // Auto-initialize the workflow on first state definition
        let wf_record = match wf_record {
            Some(r) => r,
            None => json!({
                "workflow": input.workflow,
                "states": "[]",
                "transitions": "[]",
                "entities": "{}",
            }),
        };

        let states_str = wf_record["states"].as_str().unwrap_or("[]");
        let mut states: Vec<WorkflowState> = serde_json::from_str(states_str)?;

        // Check if a state with this name already exists
        if states.iter().any(|s| s.name == input.name) {
            return Ok(WorkflowDefineStateOutput::Exists {
                message: "A state with this name already exists in the workflow".to_string(),
            });
        }

        states.push(WorkflowState {
            name: input.name.clone(),
            flags: input.flags.clone(),
        });

        let mut updated = wf_record.clone();
        updated["states"] = json!(serde_json::to_string(&states)?);
        storage.put("workflow", &input.workflow, updated).await?;

        Ok(WorkflowDefineStateOutput::Ok)
    }

    async fn define_transition(
        &self,
        input: WorkflowDefineTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowDefineTransitionOutput, Box<dyn std::error::Error>> {
        let wf_record = storage.get("workflow", &input.workflow).await?;
        let wf_record = match wf_record {
            Some(r) => r,
            None => {
                return Ok(WorkflowDefineTransitionOutput::Error {
                    message: "Workflow does not exist".to_string(),
                });
            }
        };

        let states_str = wf_record["states"].as_str().unwrap_or("[]");
        let states: Vec<WorkflowState> = serde_json::from_str(states_str)?;
        let state_names: Vec<&str> = states.iter().map(|s| s.name.as_str()).collect();

        // Validate that both states exist
        if !state_names.contains(&input.from.as_str()) {
            return Ok(WorkflowDefineTransitionOutput::Error {
                message: format!("Source state \"{}\" does not exist", input.from),
            });
        }
        if !state_names.contains(&input.to.as_str()) {
            return Ok(WorkflowDefineTransitionOutput::Error {
                message: format!("Target state \"{}\" does not exist", input.to),
            });
        }

        let transitions_str = wf_record["transitions"].as_str().unwrap_or("[]");
        let mut transitions: Vec<WorkflowTransition> = serde_json::from_str(transitions_str)?;

        transitions.push(WorkflowTransition {
            from: input.from.clone(),
            to: input.to.clone(),
            label: input.label.clone(),
            guard: input.guard.clone(),
        });

        let mut updated = wf_record.clone();
        updated["transitions"] = json!(serde_json::to_string(&transitions)?);
        storage.put("workflow", &input.workflow, updated).await?;

        Ok(WorkflowDefineTransitionOutput::Ok)
    }

    async fn transition(
        &self,
        input: WorkflowTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowTransitionOutput, Box<dyn std::error::Error>> {
        let wf_record = storage.get("workflow", &input.workflow).await?;
        let wf_record = match wf_record {
            Some(r) => r,
            None => {
                return Ok(WorkflowTransitionOutput::Notfound {
                    message: "The workflow was not found".to_string(),
                });
            }
        };

        let states_str = wf_record["states"].as_str().unwrap_or("[]");
        let states: Vec<WorkflowState> = serde_json::from_str(states_str)?;

        let transitions_str = wf_record["transitions"].as_str().unwrap_or("[]");
        let transitions: Vec<WorkflowTransition> = serde_json::from_str(transitions_str)?;

        let entities_str = wf_record["entities"].as_str().unwrap_or("{}");
        let mut entities: std::collections::HashMap<String, String> =
            serde_json::from_str(entities_str)?;

        // Determine entity's current state; default to the initial state
        let current_state = match entities.get(&input.entity) {
            Some(state) => state.clone(),
            None => {
                let initial = states.iter().find(|s| s.flags.contains("initial"));
                match initial {
                    Some(s) => s.name.clone(),
                    None => {
                        return Ok(WorkflowTransitionOutput::Notfound {
                            message: "No initial state defined in the workflow".to_string(),
                        });
                    }
                }
            }
        };

        // Find matching transition from current state with the given label
        let matching = transitions
            .iter()
            .find(|t| t.from == current_state && t.label == input.transition);

        let matching = match matching {
            Some(t) => t,
            None => {
                return Ok(WorkflowTransitionOutput::Notfound {
                    message: format!(
                        "No transition \"{}\" from state \"{}\"",
                        input.transition, current_state
                    ),
                });
            }
        };

        // Guard evaluation: in a full implementation guards would be evaluated
        // against a runtime context. Here we assume guards pass.
        let _guard_passes = true;

        // Move entity to the new state
        let new_state = matching.to.clone();
        entities.insert(input.entity.clone(), new_state.clone());

        let mut updated = wf_record.clone();
        updated["entities"] = json!(serde_json::to_string(&entities)?);
        storage.put("workflow", &input.workflow, updated).await?;

        Ok(WorkflowTransitionOutput::Ok { new_state })
    }

    async fn get_current_state(
        &self,
        input: WorkflowGetCurrentStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkflowGetCurrentStateOutput, Box<dyn std::error::Error>> {
        let wf_record = storage.get("workflow", &input.workflow).await?;
        let wf_record = match wf_record {
            Some(r) => r,
            None => {
                return Ok(WorkflowGetCurrentStateOutput::Notfound {
                    message: "The workflow was not found".to_string(),
                });
            }
        };

        let states_str = wf_record["states"].as_str().unwrap_or("[]");
        let states: Vec<WorkflowState> = serde_json::from_str(states_str)?;

        let entities_str = wf_record["entities"].as_str().unwrap_or("{}");
        let entities: std::collections::HashMap<String, String> =
            serde_json::from_str(entities_str)?;

        let current_state = match entities.get(&input.entity) {
            Some(state) => state.clone(),
            None => {
                let initial = states.iter().find(|s| s.flags.contains("initial"));
                match initial {
                    Some(s) => s.name.clone(),
                    None => {
                        return Ok(WorkflowGetCurrentStateOutput::Notfound {
                            message: "Entity not found and no initial state defined".to_string(),
                        });
                    }
                }
            }
        };

        Ok(WorkflowGetCurrentStateOutput::Ok {
            state: current_state,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_state_success() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        let result = handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineStateOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_state_exists() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineStateOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_no_workflow() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        let result = handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "nonexistent".to_string(),
                from: "draft".to_string(),
                to: "published".to_string(),
                label: "publish".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineTransitionOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_success() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "published".to_string(),
                flags: "final".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "publish".to_string(),
                from: "draft".to_string(),
                to: "published".to_string(),
                label: "publish".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineTransitionOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_transition_success() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "published".to_string(),
                flags: "final".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "publish".to_string(),
                from: "draft".to_string(),
                to: "published".to_string(),
                label: "publish".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.transition(
            WorkflowTransitionInput {
                workflow: "publish".to_string(),
                entity: "article-1".to_string(),
                transition: "publish".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowTransitionOutput::Ok { new_state } => {
                assert_eq!(new_state, "published");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_transition_workflow_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        let result = handler.transition(
            WorkflowTransitionInput {
                workflow: "nonexistent".to_string(),
                entity: "article-1".to_string(),
                transition: "publish".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowTransitionOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_current_state_initial() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "publish".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_current_state(
            WorkflowGetCurrentStateInput {
                workflow: "publish".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowGetCurrentStateOutput::Ok { state } => {
                assert_eq!(state, "draft");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_current_state_workflow_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        let result = handler.get_current_state(
            WorkflowGetCurrentStateInput {
                workflow: "nonexistent".to_string(),
                entity: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowGetCurrentStateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_invalid_source_state() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "wf".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "wf".to_string(),
                from: "nonexistent".to_string(),
                to: "draft".to_string(),
                label: "go".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineTransitionOutput::Error { message } => {
                assert!(message.contains("nonexistent"));
            },
            other => panic!("Expected Error variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_define_transition_invalid_target_state() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "wf2".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "wf2".to_string(),
                from: "draft".to_string(),
                to: "nonexistent".to_string(),
                label: "go".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowDefineTransitionOutput::Error { message } => {
                assert!(message.contains("nonexistent"));
            },
            other => panic!("Expected Error variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_get_current_state_after_transition() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "lifecycle".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "lifecycle".to_string(),
                name: "review".to_string(),
                flags: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "lifecycle".to_string(),
                from: "draft".to_string(),
                to: "review".to_string(),
                label: "submit".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.transition(
            WorkflowTransitionInput {
                workflow: "lifecycle".to_string(),
                entity: "doc-1".to_string(),
                transition: "submit".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_current_state(
            WorkflowGetCurrentStateInput {
                workflow: "lifecycle".to_string(),
                entity: "doc-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowGetCurrentStateOutput::Ok { state } => {
                assert_eq!(state, "review");
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_transition_no_matching_label() {
        let storage = InMemoryStorage::new();
        let handler = WorkflowHandlerImpl;
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "wf-nm".to_string(),
                name: "draft".to_string(),
                flags: "initial".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_state(
            WorkflowDefineStateInput {
                workflow: "wf-nm".to_string(),
                name: "published".to_string(),
                flags: "final".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.define_transition(
            WorkflowDefineTransitionInput {
                workflow: "wf-nm".to_string(),
                from: "draft".to_string(),
                to: "published".to_string(),
                label: "publish".to_string(),
                guard: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.transition(
            WorkflowTransitionInput {
                workflow: "wf-nm".to_string(),
                entity: "article-1".to_string(),
                transition: "wrong-label".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkflowTransitionOutput::Notfound { message } => {
                assert!(message.contains("wrong-label"));
            },
            other => panic!("Expected Notfound variant, got {:?}", other),
        }
    }
}
