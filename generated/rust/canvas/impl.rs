// Canvas Handler Implementation
//
// Spatial arrangement of content nodes on a 2D canvas.
// Manages node positions, grouping, and auto-creation of canvas on first use.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CanvasHandler;
use serde_json::json;

pub struct CanvasHandlerImpl;

#[async_trait]
impl CanvasHandler for CanvasHandlerImpl {
    async fn add_node(
        &self,
        input: CanvasAddNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasAddNodeOutput, Box<dyn std::error::Error>> {
        let canvas_id = &input.canvas;
        let node = &input.node;
        let x = input.x;
        let y = input.y;

        let existing = storage.get("canvas", canvas_id).await?;

        let (mut nodes, mut positions) = match &existing {
            Some(rec) => {
                let nodes: Vec<String> = serde_json::from_str(
                    rec["nodes"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                let positions: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
                    rec["positions"].as_str().unwrap_or("{}")
                ).unwrap_or_default();
                (nodes, positions)
            }
            None => (Vec::new(), serde_json::Map::new()),
        };

        nodes.push(node.clone());
        positions.insert(node.clone(), json!({"x": x, "y": y}));

        storage.put("canvas", canvas_id, json!({
            "canvas": canvas_id,
            "nodes": serde_json::to_string(&nodes)?,
            "positions": serde_json::to_string(&positions)?,
            "edges": existing.as_ref()
                .and_then(|r| r["edges"].as_str())
                .unwrap_or("[]"),
            "groups": existing.as_ref()
                .and_then(|r| r["groups"].as_str())
                .unwrap_or("{}"),
        })).await?;

        Ok(CanvasAddNodeOutput::Ok)
    }

    async fn move_node(
        &self,
        input: CanvasMoveNodeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasMoveNodeOutput, Box<dyn std::error::Error>> {
        let canvas_id = &input.canvas;
        let node = &input.node;
        let x = input.x;
        let y = input.y;

        let existing = storage.get("canvas", canvas_id).await?;
        let existing = match existing {
            Some(rec) => rec,
            None => return Ok(CanvasMoveNodeOutput::Notfound {
                message: "Canvas not found".to_string(),
            }),
        };

        let nodes: Vec<String> = serde_json::from_str(
            existing["nodes"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        if !nodes.contains(node) {
            return Ok(CanvasMoveNodeOutput::Notfound {
                message: "Node not found on canvas".to_string(),
            });
        }

        let mut positions: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
            existing["positions"].as_str().unwrap_or("{}")
        ).unwrap_or_default();

        positions.insert(node.clone(), json!({"x": x, "y": y}));

        storage.put("canvas", canvas_id, json!({
            "canvas": canvas_id,
            "nodes": existing["nodes"],
            "positions": serde_json::to_string(&positions)?,
            "edges": existing["edges"],
            "groups": existing.get("groups").and_then(|v| v.as_str()).unwrap_or("{}"),
        })).await?;

        Ok(CanvasMoveNodeOutput::Ok)
    }

    async fn group_nodes(
        &self,
        input: CanvasGroupNodesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CanvasGroupNodesOutput, Box<dyn std::error::Error>> {
        let canvas_id = &input.canvas;
        let group_name = &input.group;

        let existing = storage.get("canvas", canvas_id).await?;
        let existing = match existing {
            Some(rec) => rec,
            None => return Ok(CanvasGroupNodesOutput::Notfound {
                message: "Canvas not found".to_string(),
            }),
        };

        let all_nodes: Vec<String> = serde_json::from_str(
            existing["nodes"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        let requested_nodes: Vec<String> = serde_json::from_str(&input.nodes)
            .unwrap_or_default();

        for n in &requested_nodes {
            if !all_nodes.contains(n) {
                return Ok(CanvasGroupNodesOutput::Notfound {
                    message: format!("Node \"{}\" not found on canvas", n),
                });
            }
        }

        let mut groups: serde_json::Map<String, serde_json::Value> = serde_json::from_str(
            existing.get("groups").and_then(|v| v.as_str()).unwrap_or("{}")
        ).unwrap_or_default();

        groups.insert(group_name.clone(), json!(requested_nodes));

        storage.put("canvas", canvas_id, json!({
            "canvas": canvas_id,
            "nodes": existing["nodes"],
            "positions": existing["positions"],
            "edges": existing["edges"],
            "groups": serde_json::to_string(&groups)?,
        })).await?;

        Ok(CanvasGroupNodesOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_node_creates_canvas() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        let result = handler.add_node(
            CanvasAddNodeInput {
                canvas: "canvas-1".to_string(),
                node: "note-1".to_string(),
                x: 100,
                y: 200,
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasAddNodeOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_move_node_success() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        handler.add_node(
            CanvasAddNodeInput {
                canvas: "canvas-2".to_string(),
                node: "note-a".to_string(),
                x: 10,
                y: 20,
            },
            &storage,
        ).await.unwrap();
        let result = handler.move_node(
            CanvasMoveNodeInput {
                canvas: "canvas-2".to_string(),
                node: "note-a".to_string(),
                x: 50,
                y: 60,
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasMoveNodeOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_move_node_canvas_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        let result = handler.move_node(
            CanvasMoveNodeInput {
                canvas: "nonexistent".to_string(),
                node: "note-1".to_string(),
                x: 0,
                y: 0,
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasMoveNodeOutput::Notfound { message } => {
                assert!(message.contains("Canvas not found"));
            }
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_move_node_node_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        handler.add_node(
            CanvasAddNodeInput {
                canvas: "canvas-3".to_string(),
                node: "existing".to_string(),
                x: 10,
                y: 20,
            },
            &storage,
        ).await.unwrap();
        let result = handler.move_node(
            CanvasMoveNodeInput {
                canvas: "canvas-3".to_string(),
                node: "missing-node".to_string(),
                x: 0,
                y: 0,
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasMoveNodeOutput::Notfound { message } => {
                assert!(message.contains("Node not found"));
            }
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_group_nodes_success() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        handler.add_node(
            CanvasAddNodeInput {
                canvas: "canvas-4".to_string(),
                node: "n1".to_string(),
                x: 0,
                y: 0,
            },
            &storage,
        ).await.unwrap();
        handler.add_node(
            CanvasAddNodeInput {
                canvas: "canvas-4".to_string(),
                node: "n2".to_string(),
                x: 10,
                y: 10,
            },
            &storage,
        ).await.unwrap();
        let result = handler.group_nodes(
            CanvasGroupNodesInput {
                canvas: "canvas-4".to_string(),
                nodes: r#"["n1","n2"]"#.to_string(),
                group: "group-a".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasGroupNodesOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_group_nodes_canvas_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CanvasHandlerImpl;
        let result = handler.group_nodes(
            CanvasGroupNodesInput {
                canvas: "missing-canvas".to_string(),
                nodes: r#"["n1"]"#.to_string(),
                group: "g1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CanvasGroupNodesOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
