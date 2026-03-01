// View handler implementation
// Database views with filters, sorts, groups, visible fields, layout,
// duplication, and embed code generation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ViewHandler;
use serde_json::json;

pub struct ViewHandlerImpl;

fn default_view_record(view: &str) -> serde_json::Value {
    json!({
        "view": view,
        "dataSource": "",
        "layout": "",
        "filters": "",
        "sorts": "",
        "groups": "",
        "visibleFields": "",
        "formatting": "",
    })
}

#[async_trait]
impl ViewHandler for ViewHandlerImpl {
    async fn create(
        &self,
        input: ViewCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewCreateOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        if existing.is_some() {
            return Ok(ViewCreateOutput::Error {
                message: "View already exists".to_string(),
            });
        }

        storage.put("view", view, json!({
            "view": view,
            "dataSource": &input.data_source,
            "layout": &input.layout,
            "filters": "",
            "sorts": "",
            "groups": "",
            "visibleFields": "",
            "formatting": "",
        })).await?;

        Ok(ViewCreateOutput::Ok { view: view.clone() })
    }

    async fn set_filter(
        &self,
        input: ViewSetFilterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetFilterOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let mut record = existing.unwrap_or_else(|| default_view_record(view));

        if let Some(obj) = record.as_object_mut() {
            obj.insert("filters".to_string(), json!(&input.filter));
        }
        storage.put("view", view, record).await?;

        Ok(ViewSetFilterOutput::Ok { view: view.clone() })
    }

    async fn set_sort(
        &self,
        input: ViewSetSortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetSortOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let mut record = match existing {
            Some(r) => r,
            None => return Ok(ViewSetSortOutput::Notfound {
                message: "View not found".to_string(),
            }),
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("sorts".to_string(), json!(&input.sort));
        }
        storage.put("view", view, record).await?;

        Ok(ViewSetSortOutput::Ok { view: view.clone() })
    }

    async fn set_group(
        &self,
        input: ViewSetGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetGroupOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let mut record = match existing {
            Some(r) => r,
            None => return Ok(ViewSetGroupOutput::Notfound {
                message: "View not found".to_string(),
            }),
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("groups".to_string(), json!(&input.group));
        }
        storage.put("view", view, record).await?;

        Ok(ViewSetGroupOutput::Ok { view: view.clone() })
    }

    async fn set_visible_fields(
        &self,
        input: ViewSetVisibleFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetVisibleFieldsOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let mut record = match existing {
            Some(r) => r,
            None => return Ok(ViewSetVisibleFieldsOutput::Notfound {
                message: "View not found".to_string(),
            }),
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("visibleFields".to_string(), json!(&input.fields));
        }
        storage.put("view", view, record).await?;

        Ok(ViewSetVisibleFieldsOutput::Ok { view: view.clone() })
    }

    async fn change_layout(
        &self,
        input: ViewChangeLayoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewChangeLayoutOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let mut record = existing.unwrap_or_else(|| default_view_record(view));

        if let Some(obj) = record.as_object_mut() {
            obj.insert("layout".to_string(), json!(&input.layout));
        }
        storage.put("view", view, record).await?;

        Ok(ViewChangeLayoutOutput::Ok { view: view.clone() })
    }

    async fn duplicate(
        &self,
        input: ViewDuplicateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewDuplicateOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(ViewDuplicateOutput::Notfound {
                message: "View not found".to_string(),
            }),
        };

        let new_view = format!("{}-copy-{}", view, 1000000);
        let mut cloned = existing.clone();
        if let Some(obj) = cloned.as_object_mut() {
            obj.insert("view".to_string(), json!(&new_view));
        }
        storage.put("view", &new_view, cloned).await?;

        Ok(ViewDuplicateOutput::Ok { new_view })
    }

    async fn embed(
        &self,
        input: ViewEmbedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewEmbedOutput, Box<dyn std::error::Error>> {
        let view = &input.view;

        let existing = storage.get("view", view).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(ViewEmbedOutput::Notfound {
                message: "View not found".to_string(),
            }),
        };

        let embed_code = json!({
            "type": "embed",
            "view": view,
            "dataSource": existing.get("dataSource").and_then(|v| v.as_str()).unwrap_or(""),
            "layout": existing.get("layout").and_then(|v| v.as_str()).unwrap_or(""),
            "filters": existing.get("filters").and_then(|v| v.as_str()).unwrap_or(""),
            "sorts": existing.get("sorts").and_then(|v| v.as_str()).unwrap_or(""),
            "groups": existing.get("groups").and_then(|v| v.as_str()).unwrap_or(""),
        });

        Ok(ViewEmbedOutput::Ok {
            embed_code: serde_json::to_string(&embed_code)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_success() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        let result = handler.create(
            ViewCreateInput {
                view: "view-1".to_string(),
                data_source: "users".to_string(),
                layout: "table".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewCreateOutput::Ok { view } => {
                assert_eq!(view, "view-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        handler.create(
            ViewCreateInput {
                view: "view-1".to_string(),
                data_source: "users".to_string(),
                layout: "table".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            ViewCreateInput {
                view: "view-1".to_string(),
                data_source: "users".to_string(),
                layout: "table".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewCreateOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_set_sort_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        let result = handler.set_sort(
            ViewSetSortInput {
                view: "nonexistent".to_string(),
                sort: "name:asc".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewSetSortOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_duplicate_success() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        handler.create(
            ViewCreateInput {
                view: "view-1".to_string(),
                data_source: "users".to_string(),
                layout: "table".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.duplicate(
            ViewDuplicateInput { view: "view-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ViewDuplicateOutput::Ok { new_view } => {
                assert!(new_view.contains("view-1"));
                assert!(new_view.contains("copy"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_duplicate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        let result = handler.duplicate(
            ViewDuplicateInput { view: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ViewDuplicateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_embed_success() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        handler.create(
            ViewCreateInput {
                view: "view-1".to_string(),
                data_source: "users".to_string(),
                layout: "table".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.embed(
            ViewEmbedInput { view: "view-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ViewEmbedOutput::Ok { embed_code } => {
                assert!(embed_code.contains("embed"));
                assert!(embed_code.contains("view-1"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_embed_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ViewHandlerImpl;
        let result = handler.embed(
            ViewEmbedInput { view: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ViewEmbedOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
