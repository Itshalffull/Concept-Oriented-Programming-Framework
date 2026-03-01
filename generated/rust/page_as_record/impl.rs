// PageAsRecord concept implementation
// Treat pages as structured records with typed properties and a freeform body.
// Supports schema attachment, property get/set, and freeform-to-structured conversion.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PageAsRecordHandler;
use serde_json::json;

pub struct PageAsRecordHandlerImpl;

#[async_trait]
impl PageAsRecordHandler for PageAsRecordHandlerImpl {
    async fn create(
        &self,
        input: PageAsRecordCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("page", &input.page).await?;
        if existing.is_some() {
            return Ok(PageAsRecordCreateOutput::Exists { message: "already exists".to_string() });
        }

        storage.put("page", &input.page, json!({
            "page": input.page,
            "schema": input.schema,
            "properties": "{}",
            "body": ""
        })).await?;

        Ok(PageAsRecordCreateOutput::Ok { page: input.page })
    }

    async fn set_property(
        &self,
        input: PageAsRecordSetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordSetPropertyOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("page", &input.page).await? {
            Some(r) => r,
            None => return Ok(PageAsRecordSetPropertyOutput::Notfound { message: "Page not found".to_string() }),
        };

        // Check schema fields if defined
        if let Ok(schema) = serde_json::from_str::<serde_json::Value>(existing["schema"].as_str().unwrap_or("{}")) {
            if let Some(fields) = schema["fields"].as_array() {
                let field_names: Vec<&str> = fields.iter().filter_map(|f| f.as_str()).collect();
                if !field_names.is_empty() && !field_names.contains(&input.key.as_str()) {
                    return Ok(PageAsRecordSetPropertyOutput::Invalid {
                        message: format!("Key '{}' is not defined in the page schema", input.key),
                    });
                }
            }
        }

        let mut properties: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
            existing["properties"].as_str().unwrap_or("{}")
        ).unwrap_or_default();
        properties.insert(input.key, json!(input.value));

        let mut updated = existing.clone();
        updated["properties"] = json!(serde_json::to_string(&properties)?);
        storage.put("page", &input.page, updated).await?;

        Ok(PageAsRecordSetPropertyOutput::Ok { page: input.page })
    }

    async fn get_property(
        &self,
        input: PageAsRecordGetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordGetPropertyOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("page", &input.page).await? {
            Some(r) => r,
            None => return Ok(PageAsRecordGetPropertyOutput::Notfound { message: "Page not found".to_string() }),
        };

        let properties: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
            existing["properties"].as_str().unwrap_or("{}")
        ).unwrap_or_default();

        match properties.get(&input.key) {
            Some(v) => Ok(PageAsRecordGetPropertyOutput::Ok { value: v.as_str().unwrap_or("").to_string() }),
            None => Ok(PageAsRecordGetPropertyOutput::Notfound { message: "Property not found".to_string() }),
        }
    }

    async fn append_to_body(
        &self,
        input: PageAsRecordAppendToBodyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordAppendToBodyOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("page", &input.page).await? {
            Some(r) => r,
            None => return Ok(PageAsRecordAppendToBodyOutput::Notfound { message: "Page not found".to_string() }),
        };

        let current_body = existing["body"].as_str().unwrap_or("");
        let mut updated = existing.clone();
        updated["body"] = json!(format!("{}{}", current_body, input.content));
        storage.put("page", &input.page, updated).await?;

        Ok(PageAsRecordAppendToBodyOutput::Ok { page: input.page })
    }

    async fn attach_to_schema(
        &self,
        input: PageAsRecordAttachToSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordAttachToSchemaOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("page", &input.page).await? {
            Some(r) => r,
            None => return Ok(PageAsRecordAttachToSchemaOutput::Notfound { message: "Page not found".to_string() }),
        };

        let mut updated = existing.clone();
        updated["schema"] = json!(input.schema);
        storage.put("page", &input.page, updated).await?;

        Ok(PageAsRecordAttachToSchemaOutput::Ok { page: input.page })
    }

    async fn convert_from_freeform(
        &self,
        input: PageAsRecordConvertFromFreeformInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordConvertFromFreeformOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("page", &input.page).await? {
            Some(r) => r,
            None => return Ok(PageAsRecordConvertFromFreeformOutput::Notfound { message: "Page not found".to_string() }),
        };

        let body = existing["body"].as_str().unwrap_or("");
        let mut properties: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
            existing["properties"].as_str().unwrap_or("{}")
        ).unwrap_or_default();

        // Extract key:value pairs from body using schema fields
        if let Ok(schema) = serde_json::from_str::<serde_json::Value>(&input.schema) {
            if let Some(fields) = schema["fields"].as_array() {
                for field in fields {
                    if let Some(field_name) = field.as_str() {
                        // Search body for "field: value" pattern
                        let pattern = format!("{}:", field_name);
                        if let Some(pos) = body.to_lowercase().find(&pattern.to_lowercase()) {
                            let after = &body[pos + pattern.len()..];
                            let value = after.lines().next().unwrap_or("").trim();
                            if !value.is_empty() {
                                properties.insert(field_name.to_string(), json!(value));
                            }
                        }
                    }
                }
            }
        }

        let mut updated = existing.clone();
        updated["schema"] = json!(input.schema);
        updated["properties"] = json!(serde_json::to_string(&properties)?);
        storage.put("page", &input.page, updated).await?;

        Ok(PageAsRecordConvertFromFreeformOutput::Ok { page: input.page })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_page() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        let result = handler.create(
            PageAsRecordCreateInput { page: "page-1".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordCreateOutput::Ok { page } => assert_eq!(page, "page-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate_page() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        handler.create(
            PageAsRecordCreateInput { page: "page-1".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            PageAsRecordCreateInput { page: "page-1".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordCreateOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_set_and_get_property() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        handler.create(
            PageAsRecordCreateInput { page: "page-1".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        handler.set_property(
            PageAsRecordSetPropertyInput { page: "page-1".to_string(), key: "title".to_string(), value: "Hello".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.get_property(
            PageAsRecordGetPropertyInput { page: "page-1".to_string(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordGetPropertyOutput::Ok { value } => assert_eq!(value, "Hello"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_property_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        let result = handler.get_property(
            PageAsRecordGetPropertyInput { page: "nonexistent".to_string(), key: "title".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordGetPropertyOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_append_to_body() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        handler.create(
            PageAsRecordCreateInput { page: "page-1".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.append_to_body(
            PageAsRecordAppendToBodyInput { page: "page-1".to_string(), content: "Hello world".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordAppendToBodyOutput::Ok { page } => assert_eq!(page, "page-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_attach_to_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        let result = handler.attach_to_schema(
            PageAsRecordAttachToSchemaInput { page: "nonexistent".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordAttachToSchemaOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_convert_from_freeform_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandlerImpl;
        let result = handler.convert_from_freeform(
            PageAsRecordConvertFromFreeformInput { page: "nonexistent".to_string(), schema: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PageAsRecordConvertFromFreeformOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
