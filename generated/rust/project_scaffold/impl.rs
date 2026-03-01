// ProjectScaffold -- generates initial project structure from a project name,
// creating standard directories and configuration files.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProjectScaffoldHandler;
use serde_json::json;

pub struct ProjectScaffoldHandlerImpl;

#[async_trait]
impl ProjectScaffoldHandler for ProjectScaffoldHandlerImpl {
    async fn scaffold(
        &self,
        input: ProjectScaffoldScaffoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectScaffoldScaffoldOutput, Box<dyn std::error::Error>> {
        // Check if a project with this name already exists
        let existing = storage.get("project", &input.name).await?;
        if existing.is_some() {
            return Ok(ProjectScaffoldScaffoldOutput::AlreadyExists {
                name: input.name,
            });
        }

        let path = format!("./{}", input.name);

        // Create the project scaffold record with standard structure
        storage.put("project", &input.name, json!({
            "name": input.name,
            "path": path,
            "directories": [
                "src",
                "tests",
                "docs",
                "config"
            ],
            "files": [
                "suite.yaml",
                "README.md",
                "src/mod.rs"
            ],
            "scaffoldedAt": chrono::Utc::now().timestamp_millis(),
        })).await?;

        Ok(ProjectScaffoldScaffoldOutput::Ok {
            project: input.name,
            path,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_scaffold_new_project() {
        let storage = InMemoryStorage::new();
        let handler = ProjectScaffoldHandlerImpl;
        let result = handler.scaffold(
            ProjectScaffoldScaffoldInput { name: "my-project".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProjectScaffoldScaffoldOutput::Ok { project, path } => {
                assert_eq!(project, "my-project");
                assert!(path.contains("my-project"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_scaffold_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = ProjectScaffoldHandlerImpl;
        handler.scaffold(
            ProjectScaffoldScaffoldInput { name: "my-project".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.scaffold(
            ProjectScaffoldScaffoldInput { name: "my-project".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProjectScaffoldScaffoldOutput::AlreadyExists { name } => {
                assert_eq!(name, "my-project");
            }
            _ => panic!("Expected AlreadyExists variant"),
        }
    }
}
