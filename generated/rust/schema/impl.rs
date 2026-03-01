use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SchemaHandler;
use serde_json::json;

pub struct SchemaHandlerImpl;

#[async_trait]
impl SchemaHandler for SchemaHandlerImpl {
    async fn define_schema(
        &self,
        input: SchemaDefineSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaDefineSchemaOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("schema", &input.schema).await?;
        if existing.is_some() {
            return Ok(SchemaDefineSchemaOutput::Exists {
                message: format!("Schema '{}' already exists", input.schema),
            });
        }

        storage.put("schema", &input.schema, json!({
            "name": input.schema,
            "fields": input.fields,
            "parent": null
        })).await?;

        Ok(SchemaDefineSchemaOutput::Ok)
    }

    async fn add_field(
        &self,
        input: SchemaAddFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaAddFieldOutput, Box<dyn std::error::Error>> {
        let record = storage.get("schema", &input.schema).await?;
        if record.is_none() {
            return Ok(SchemaAddFieldOutput::Notfound {
                message: format!("Schema '{}' not found", input.schema),
            });
        }

        let mut record = record.unwrap();
        let fields_str = record.get("fields").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let new_fields = if fields_str.is_empty() {
            input.field
        } else {
            format!("{},{}", fields_str, input.field)
        };
        record["fields"] = json!(new_fields);
        storage.put("schema", &input.schema, record).await?;

        Ok(SchemaAddFieldOutput::Ok)
    }

    async fn extend_schema(
        &self,
        input: SchemaExtendSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaExtendSchemaOutput, Box<dyn std::error::Error>> {
        let child = storage.get("schema", &input.schema).await?;
        if child.is_none() {
            return Ok(SchemaExtendSchemaOutput::Notfound {
                message: format!("Schema '{}' not found", input.schema),
            });
        }

        let parent = storage.get("schema", &input.parent).await?;
        if parent.is_none() {
            return Ok(SchemaExtendSchemaOutput::Notfound {
                message: format!("Parent schema '{}' not found", input.parent),
            });
        }

        let mut child = child.unwrap();
        child["parent"] = json!(input.parent);
        storage.put("schema", &input.schema, child).await?;

        Ok(SchemaExtendSchemaOutput::Ok)
    }

    async fn apply_to(
        &self,
        input: SchemaApplyToInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaApplyToOutput, Box<dyn std::error::Error>> {
        let schema = storage.get("schema", &input.schema).await?;
        if schema.is_none() {
            return Ok(SchemaApplyToOutput::Notfound {
                message: format!("Schema '{}' not found", input.schema),
            });
        }

        let key = format!("{}:{}", input.schema, input.entity);
        storage.put("schema-association", &key, json!({
            "entity": input.entity,
            "schema": input.schema
        })).await?;

        Ok(SchemaApplyToOutput::Ok)
    }

    async fn remove_from(
        &self,
        input: SchemaRemoveFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaRemoveFromOutput, Box<dyn std::error::Error>> {
        let key = format!("{}:{}", input.schema, input.entity);
        let existing = storage.get("schema-association", &key).await?;
        if existing.is_none() {
            return Ok(SchemaRemoveFromOutput::Notfound {
                message: format!("Association not found between '{}' and '{}'", input.schema, input.entity),
            });
        }

        storage.del("schema-association", &key).await?;
        Ok(SchemaRemoveFromOutput::Ok)
    }

    async fn get_associations(
        &self,
        input: SchemaGetAssociationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaGetAssociationsOutput, Box<dyn std::error::Error>> {
        let schema = storage.get("schema", &input.schema).await?;
        if schema.is_none() {
            return Ok(SchemaGetAssociationsOutput::Notfound {
                message: format!("Schema '{}' not found", input.schema),
            });
        }

        let all = storage.find("schema-association", Some(&json!({"schema": input.schema}))).await?;
        let entities: Vec<String> = all.iter()
            .filter_map(|a| a.get("entity").and_then(|v| v.as_str()).map(String::from))
            .collect();

        Ok(SchemaGetAssociationsOutput::Ok {
            associations: serde_json::to_string(&entities)?,
        })
    }

    async fn export(
        &self,
        input: SchemaExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaExportOutput, Box<dyn std::error::Error>> {
        let schema = storage.get("schema", &input.schema).await?;
        if schema.is_none() {
            return Ok(SchemaExportOutput::Notfound {
                message: format!("Schema '{}' not found", input.schema),
            });
        }

        let schema = schema.unwrap();

        // Collect inherited fields from parent chain
        let mut all_fields = Vec::new();
        let fields_str = schema.get("fields").and_then(|v| v.as_str()).unwrap_or("");
        for f in fields_str.split(',').filter(|s| !s.is_empty()) {
            all_fields.push(f.trim().to_string());
        }

        let mut parent_name = schema.get("parent").and_then(|v| v.as_str()).map(String::from);
        while let Some(pname) = &parent_name {
            if let Some(parent) = storage.get("schema", pname).await? {
                let pfields = parent.get("fields").and_then(|v| v.as_str()).unwrap_or("");
                for f in pfields.split(',').filter(|s| !s.is_empty()) {
                    all_fields.push(f.trim().to_string());
                }
                parent_name = parent.get("parent").and_then(|v| v.as_str()).map(String::from);
            } else {
                break;
            }
        }

        Ok(SchemaExportOutput::Ok {
            data: serde_json::to_string(&json!({
                "name": input.schema,
                "fields": all_fields,
                "parent": schema.get("parent")
            }))?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_schema_success() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        let result = handler.define_schema(
            SchemaDefineSchemaInput { schema: "user".to_string(), fields: "name,email".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaDefineSchemaOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_schema_exists() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        handler.define_schema(
            SchemaDefineSchemaInput { schema: "user".to_string(), fields: "name".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.define_schema(
            SchemaDefineSchemaInput { schema: "user".to_string(), fields: "email".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaDefineSchemaOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_add_field_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        let result = handler.add_field(
            SchemaAddFieldInput { schema: "missing".to_string(), field: "age".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaAddFieldOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_to_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        let result = handler.apply_to(
            SchemaApplyToInput { schema: "missing".to_string(), entity: "e1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaApplyToOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_from_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        let result = handler.remove_from(
            SchemaRemoveFromInput { schema: "s".to_string(), entity: "e".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaRemoveFromOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_export_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        let result = handler.export(
            SchemaExportInput { schema: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaExportOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_export_success() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandlerImpl;
        handler.define_schema(
            SchemaDefineSchemaInput { schema: "user".to_string(), fields: "name,email".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.export(
            SchemaExportInput { schema: "user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SchemaExportOutput::Ok { data } => {
                assert!(data.contains("name"));
                assert!(data.contains("email"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
