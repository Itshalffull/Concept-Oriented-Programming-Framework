// Surface concept: manages UI rendering surfaces with lifecycle (create, attach,
// mount, unmount, resize, destroy). Supports multiple surface kinds (dom, canvas,
// native) and renderer attachment with compatibility checking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SurfaceHandler;
use serde_json::json;

pub struct SurfaceHandlerImpl;

const SUPPORTED_KINDS: &[&str] = &["dom", "canvas", "native", "webgl", "svg"];

fn generate_surface_id(name: &str) -> String {
    format!("surface-{}-{}", name, std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0))
}

#[async_trait]
impl SurfaceHandler for SurfaceHandlerImpl {
    async fn create(
        &self,
        input: SurfaceCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceCreateOutput, Box<dyn std::error::Error>> {
        if !SUPPORTED_KINDS.contains(&input.kind.as_str()) {
            return Ok(SurfaceCreateOutput::Unsupported {
                message: format!(
                    "Unsupported surface kind: \"{}\". Supported: {}",
                    input.kind,
                    SUPPORTED_KINDS.join(", ")
                ),
            });
        }

        let surface_id = generate_surface_id(&input.surface);
        let mount_point = input.mount_point.as_deref().unwrap_or("body");

        storage.put("surface", &surface_id, json!({
            "id": &surface_id,
            "name": &input.surface,
            "kind": &input.kind,
            "mountPoint": mount_point,
            "status": "created",
            "renderer": null,
            "mountedTree": null,
            "width": 0,
            "height": 0,
        })).await?;

        Ok(SurfaceCreateOutput::Ok { surface: surface_id })
    }

    async fn attach(
        &self,
        input: SurfaceAttachInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceAttachOutput, Box<dyn std::error::Error>> {
        let record = storage.get("surface", &input.surface).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SurfaceAttachOutput::Incompatible {
                    message: format!("Surface \"{}\" not found", input.surface),
                });
            }
        };

        let kind = record["kind"].as_str().unwrap_or("");

        // Check renderer compatibility with surface kind
        let compatible = match (kind, input.renderer.as_str()) {
            ("dom", "react") | ("dom", "svelte") | ("dom", "vue") | ("dom", "solid") => true,
            ("canvas", "canvas2d") | ("canvas", "pixi") => true,
            ("webgl", "three") | ("webgl", "babylon") => true,
            ("native", "swiftui") | ("native", "compose") | ("native", "flutter") => true,
            ("svg", "d3") | ("svg", "svg-native") => true,
            _ => false,
        };

        if !compatible {
            return Ok(SurfaceAttachOutput::Incompatible {
                message: format!(
                    "Renderer \"{}\" is not compatible with surface kind \"{}\"",
                    input.renderer, kind
                ),
            });
        }

        let mut updated = record.clone();
        updated["renderer"] = json!(input.renderer);
        updated["status"] = json!("attached");
        storage.put("surface", &input.surface, updated).await?;

        Ok(SurfaceAttachOutput::Ok { surface: input.surface })
    }

    async fn resize(
        &self,
        input: SurfaceResizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceResizeOutput, Box<dyn std::error::Error>> {
        let record = storage.get("surface", &input.surface).await?;
        match record {
            Some(mut r) => {
                r["width"] = json!(input.width);
                r["height"] = json!(input.height);
                storage.put("surface", &input.surface, r).await?;
                Ok(SurfaceResizeOutput::Ok { surface: input.surface })
            }
            None => Ok(SurfaceResizeOutput::Notfound {
                message: format!("Surface \"{}\" not found", input.surface),
            }),
        }
    }

    async fn mount(
        &self,
        input: SurfaceMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceMountOutput, Box<dyn std::error::Error>> {
        let record = storage.get("surface", &input.surface).await?;
        match record {
            Some(mut r) => {
                let status = r["status"].as_str().unwrap_or("");
                if status != "attached" && status != "mounted" {
                    return Ok(SurfaceMountOutput::Error {
                        message: "Surface must be attached before mounting".to_string(),
                    });
                }
                let zone = input.zone.as_deref().unwrap_or("root");
                r["mountedTree"] = json!(input.tree);
                r["mountZone"] = json!(zone);
                r["status"] = json!("mounted");
                storage.put("surface", &input.surface, r).await?;
                Ok(SurfaceMountOutput::Ok { surface: input.surface })
            }
            None => Ok(SurfaceMountOutput::Notfound {
                message: format!("Surface \"{}\" not found", input.surface),
            }),
        }
    }

    async fn unmount(
        &self,
        input: SurfaceUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceUnmountOutput, Box<dyn std::error::Error>> {
        let record = storage.get("surface", &input.surface).await?;
        match record {
            Some(mut r) => {
                r["mountedTree"] = json!(null);
                r["mountZone"] = json!(null);
                r["status"] = json!("attached");
                storage.put("surface", &input.surface, r).await?;
                Ok(SurfaceUnmountOutput::Ok { surface: input.surface })
            }
            None => Ok(SurfaceUnmountOutput::Notfound {
                message: format!("Surface \"{}\" not found", input.surface),
            }),
        }
    }

    async fn destroy(
        &self,
        input: SurfaceDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceDestroyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("surface", &input.surface).await?;
        match record {
            Some(_) => {
                storage.del("surface", &input.surface).await?;
                Ok(SurfaceDestroyOutput::Ok { surface: input.surface })
            }
            None => Ok(SurfaceDestroyOutput::Notfound {
                message: format!("Surface \"{}\" not found", input.surface),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_dom_surface() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let result = handler.create(
            SurfaceCreateInput {
                surface: "main".to_string(),
                kind: "dom".to_string(),
                mount_point: Some("#app".to_string()),
            },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceCreateOutput::Ok { surface } => {
                assert!(surface.contains("main"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_unsupported_kind() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let result = handler.create(
            SurfaceCreateInput {
                surface: "test".to_string(),
                kind: "hologram".to_string(),
                mount_point: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceCreateOutput::Unsupported { message } => {
                assert!(message.contains("hologram"));
            },
            _ => panic!("Expected Unsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_attach_compatible_renderer() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let surface_id = match handler.create(
            SurfaceCreateInput { surface: "main".to_string(), kind: "dom".to_string(), mount_point: None },
            &storage,
        ).await.unwrap() {
            SurfaceCreateOutput::Ok { surface } => surface,
            _ => panic!("Expected Ok"),
        };
        let result = handler.attach(
            SurfaceAttachInput { surface: surface_id.clone(), renderer: "react".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceAttachOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_attach_incompatible_renderer() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let surface_id = match handler.create(
            SurfaceCreateInput { surface: "main".to_string(), kind: "dom".to_string(), mount_point: None },
            &storage,
        ).await.unwrap() {
            SurfaceCreateOutput::Ok { surface } => surface,
            _ => panic!("Expected Ok"),
        };
        let result = handler.attach(
            SurfaceAttachInput { surface: surface_id, renderer: "three".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceAttachOutput::Incompatible { message } => {
                assert!(message.contains("not compatible"));
            },
            _ => panic!("Expected Incompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_resize_nonexistent() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let result = handler.resize(
            SurfaceResizeInput { surface: "nonexistent".to_string(), width: 800, height: 600 },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceResizeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_mount_requires_attached() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let surface_id = match handler.create(
            SurfaceCreateInput { surface: "main".to_string(), kind: "dom".to_string(), mount_point: None },
            &storage,
        ).await.unwrap() {
            SurfaceCreateOutput::Ok { surface } => surface,
            _ => panic!("Expected Ok"),
        };
        let result = handler.mount(
            SurfaceMountInput { surface: surface_id, tree: "<div/>".to_string(), zone: None },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceMountOutput::Error { message } => {
                assert!(message.contains("attached"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_surface() {
        let storage = InMemoryStorage::new();
        let handler = SurfaceHandlerImpl;
        let surface_id = match handler.create(
            SurfaceCreateInput { surface: "main".to_string(), kind: "dom".to_string(), mount_point: None },
            &storage,
        ).await.unwrap() {
            SurfaceCreateOutput::Ok { surface } => surface,
            _ => panic!("Expected Ok"),
        };
        let result = handler.destroy(
            SurfaceDestroyInput { surface: surface_id },
            &storage,
        ).await.unwrap();
        match result {
            SurfaceDestroyOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }
}
