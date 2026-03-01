// NextjsSdkTarget -- generates Next.js SDK client code from interface projections.
// Produces typed API client packages with App Router-aware hooks and utilities.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NextjsSdkTargetHandler;
use serde_json::json;

pub struct NextjsSdkTargetHandlerImpl;

#[async_trait]
impl NextjsSdkTargetHandler for NextjsSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: NextjsSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let config: serde_json::Value = serde_json::from_str(&input.config)
            .unwrap_or_else(|_| json!({}));

        let app_dir = config.get("appDir").and_then(|v| v.as_str()).unwrap_or("app");
        let src_dir = config.get("srcDir").and_then(|v| v.as_str()).unwrap_or("src");
        let typescript = config.get("typescript").and_then(|v| v.as_bool()).unwrap_or(true);
        let app_router = config.get("appRouter").and_then(|v| v.as_bool()).unwrap_or(true);

        let ext = if typescript { "ts" } else { "js" };

        let projection: serde_json::Value = serde_json::from_str(&input.projection)
            .unwrap_or_else(|_| json!({}));

        let projection_id = projection.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("sdk");

        // Generate SDK files based on the projection
        let mut files = Vec::new();

        // Client module -- API fetch wrapper
        files.push(format!("{}/lib/client.{}", src_dir, ext));

        // Types file
        if typescript {
            files.push(format!("{}/lib/types.ts", src_dir));
        }

        // Hooks for App Router usage
        if app_router {
            files.push(format!("{}/hooks/use-concept.{}", src_dir, ext));
            files.push(format!("{}/hooks/use-action.{}", src_dir, ext));
        }

        // Route handler template
        files.push(format!("{}/api/[concept]/route.{}", app_dir, ext));

        // Package manifest
        let package = json!({
            "name": format!("@clef/nextjs-sdk-{}", projection_id),
            "version": "0.1.0",
            "main": format!("{}/lib/client.{}", src_dir, ext),
            "types": if typescript { Some(format!("{}/lib/types.ts", src_dir)) } else { None },
            "config": {
                "appDir": app_dir,
                "srcDir": src_dir,
                "typescript": typescript,
                "appRouter": app_router,
            },
        });

        // Store the generated SDK target
        let instance_id = format!("nextjs-sdk-{}", projection_id);
        storage.put("nextjs-sdk-target", &instance_id, json!({
            "instanceId": instance_id,
            "projectionId": projection_id,
            "appDir": app_dir,
            "srcDir": src_dir,
            "typescript": typescript,
            "appRouter": app_router,
            "fileCount": files.len(),
        })).await?;

        Ok(NextjsSdkTargetGenerateOutput::Ok {
            package: serde_json::to_string(&package)?,
            files,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_default_config() {
        let storage = InMemoryStorage::new();
        let handler = NextjsSdkTargetHandlerImpl;
        let result = handler.generate(
            NextjsSdkTargetGenerateInput {
                projection: r#"{"id":"comment"}"#.into(),
                config: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsSdkTargetGenerateOutput::Ok { package, files } => {
                assert!(package.contains("@clef/nextjs-sdk"));
                assert!(files.iter().any(|f| f.contains("client.ts")));
                assert!(files.iter().any(|f| f.contains("route.ts")));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_custom_config() {
        let storage = InMemoryStorage::new();
        let handler = NextjsSdkTargetHandlerImpl;
        let result = handler.generate(
            NextjsSdkTargetGenerateInput {
                projection: r#"{"id":"user"}"#.into(),
                config: r#"{"appDir":"my-app","srcDir":"src","typescript":true,"appRouter":true}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsSdkTargetGenerateOutput::Ok { files, .. } => {
                assert!(files.iter().any(|f| f.contains("my-app")));
            }
        }
    }
}
