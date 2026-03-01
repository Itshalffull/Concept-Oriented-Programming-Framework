// Template concept implementation
// Define reusable templates with variable substitution, triggers, and property merging.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TemplateHandler;
use serde_json::json;

pub struct TemplateHandlerImpl;

#[async_trait]
impl TemplateHandler for TemplateHandlerImpl {
    async fn define(
        &self,
        input: TemplateDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("template", &input.template).await?;
        if existing.is_some() {
            return Ok(TemplateDefineOutput::Exists {
                message: "A template with this identity already exists".to_string(),
            });
        }

        storage.put("template", &input.template, json!({
            "template": input.template,
            "body": input.body,
            "variables": input.variables,
            "triggers": "[]"
        })).await?;

        Ok(TemplateDefineOutput::Ok)
    }

    async fn instantiate(
        &self,
        input: TemplateInstantiateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateInstantiateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("template", &input.template).await?;
        if existing.is_none() {
            return Ok(TemplateInstantiateOutput::Notfound {
                message: "Template not found".to_string(),
            });
        }

        let record = existing.unwrap();
        let body = record["body"].as_str().unwrap_or("").to_string();

        // Parse key=value pairs separated by &
        let mut content = body;
        for pair in input.values.split('&') {
            let parts: Vec<&str> = pair.splitn(2, '=').collect();
            if parts.len() == 2 {
                let key = parts[0];
                let val = parts[1];
                let placeholder = format!("{{{{{}}}}}", key);
                content = content.replace(&placeholder, val);
            }
        }

        Ok(TemplateInstantiateOutput::Ok { content })
    }

    async fn register_trigger(
        &self,
        input: TemplateRegisterTriggerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateRegisterTriggerOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("template", &input.template).await?;
        if existing.is_none() {
            return Ok(TemplateRegisterTriggerOutput::Notfound {
                message: "Template not found".to_string(),
            });
        }

        let record = existing.unwrap();
        let triggers_str = record["triggers"].as_str().unwrap_or("[]");
        let mut triggers: Vec<String> = serde_json::from_str(triggers_str).unwrap_or_default();
        triggers.push(input.trigger);

        let mut updated = record.clone();
        updated["triggers"] = json!(serde_json::to_string(&triggers)?);
        storage.put("template", &input.template, updated).await?;

        Ok(TemplateRegisterTriggerOutput::Ok)
    }

    async fn merge_properties(
        &self,
        input: TemplateMergePropertiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateMergePropertiesOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("template", &input.template).await?;
        if existing.is_none() {
            return Ok(TemplateMergePropertiesOutput::Notfound {
                message: "Template not found".to_string(),
            });
        }

        let record = existing.unwrap();
        let current_variables = record["variables"].as_str().unwrap_or("");
        let merged = if current_variables.is_empty() {
            input.properties
        } else {
            format!("{},{}", current_variables, input.properties)
        };

        let mut updated = record.clone();
        updated["variables"] = json!(merged);
        storage.put("template", &input.template, updated).await?;

        Ok(TemplateMergePropertiesOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_success() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        let result = handler.define(
            TemplateDefineInput {
                template: "greeting".to_string(),
                body: "Hello, {{name}}!".to_string(),
                variables: "name".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateDefineOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_exists() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        handler.define(
            TemplateDefineInput {
                template: "greeting".to_string(),
                body: "Hello".to_string(),
                variables: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            TemplateDefineInput {
                template: "greeting".to_string(),
                body: "Hi".to_string(),
                variables: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateDefineOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_instantiate_success() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        handler.define(
            TemplateDefineInput {
                template: "greeting".to_string(),
                body: "Hello, {{name}}! Welcome to {{place}}.".to_string(),
                variables: "name,place".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.instantiate(
            TemplateInstantiateInput {
                template: "greeting".to_string(),
                values: "name=World&place=Earth".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateInstantiateOutput::Ok { content } => {
                assert_eq!(content, "Hello, World! Welcome to Earth.");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_instantiate_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        let result = handler.instantiate(
            TemplateInstantiateInput {
                template: "missing".to_string(),
                values: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateInstantiateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_register_trigger_success() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        handler.define(
            TemplateDefineInput {
                template: "t1".to_string(),
                body: "body".to_string(),
                variables: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_trigger(
            TemplateRegisterTriggerInput {
                template: "t1".to_string(),
                trigger: "on_create".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateRegisterTriggerOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_trigger_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        let result = handler.register_trigger(
            TemplateRegisterTriggerInput {
                template: "missing".to_string(),
                trigger: "on_create".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateRegisterTriggerOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_properties_success() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        handler.define(
            TemplateDefineInput {
                template: "t1".to_string(),
                body: "body".to_string(),
                variables: "a".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.merge_properties(
            TemplateMergePropertiesInput {
                template: "t1".to_string(),
                properties: "b,c".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateMergePropertiesOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_merge_properties_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TemplateHandlerImpl;
        let result = handler.merge_properties(
            TemplateMergePropertiesInput {
                template: "missing".to_string(),
                properties: "x".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemplateMergePropertiesOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
