// ChainMonitor Handler Implementation
//
// Monitors blockchain state for finality, reorgs, and
// confirmation tracking. Gate concept: awaitFinality holds
// invocations until finality conditions are met.
// Reorg detection compares parent hashes across block arrivals.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ChainMonitorHandler;
use serde_json::json;

pub struct ChainMonitorHandlerImpl;

#[async_trait]
impl ChainMonitorHandler for ChainMonitorHandlerImpl {
    async fn await_finality(
        &self,
        input: ChainMonitorAwaitFinalityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorAwaitFinalityOutput, Box<dyn std::error::Error>> {
        let tx_hash = &input.tx_hash;
        let level = if input.level.is_empty() { "default" } else { &input.level };

        // Store the pending finality request
        storage.put("subscriptions", tx_hash, json!({
            "txHash": tx_hash,
            "level": level,
            "status": "pending",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        // In a real implementation, this would be held open (gate pattern).
        // The sync engine's eventual delivery queue handles async completion.
        Ok(ChainMonitorAwaitFinalityOutput::Ok {
            chain: "pending".to_string(),
            block: 0,
            confirmations: 0,
        })
    }

    async fn subscribe(
        &self,
        input: ChainMonitorSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorSubscribeOutput, Box<dyn std::error::Error>> {
        let chain_id = input.chain_id;
        let rpc_url = &input.rpc_url;

        storage.put("chainConfig", &chain_id.to_string(), json!({
            "chainId": chain_id,
            "rpcUrl": rpc_url,
            "finalityType": "confirmations",
            "threshold": 12,
            "currentHeight": 0,
        })).await?;

        Ok(ChainMonitorSubscribeOutput::Ok { chain_id })
    }

    async fn on_block(
        &self,
        input: ChainMonitorOnBlockInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChainMonitorOnBlockOutput, Box<dyn std::error::Error>> {
        let chain_id = input.chain_id;
        let block_number = input.block_number;
        let block_hash = &input.block_hash;

        let chain_key = chain_id.to_string();
        let block_key = format!("{}:{}", chain_id, block_number);

        // Check for reorg: if we already saw this block with a different hash
        let existing_block = storage.get("blockHash", &block_key).await?;
        if let Some(existing) = existing_block {
            let stored_hash = existing["hash"].as_str().unwrap_or("");
            if stored_hash != block_hash {
                // Reorg detected
                let config = storage.get("chainConfig", &chain_key).await?;
                let current_height = config
                    .as_ref()
                    .and_then(|c| c["currentHeight"].as_i64())
                    .unwrap_or(0);
                let reorg_depth = current_height - block_number + 1;

                // Clean up invalidated blocks
                for i in block_number..=current_height {
                    let key = format!("{}:{}", chain_id, i);
                    storage.del("blockHash", &key).await?;
                }

                // Update chain height
                if let Some(mut config) = config {
                    config["currentHeight"] = json!(block_number);
                    storage.put("chainConfig", &chain_key, config).await?;
                }

                return Ok(ChainMonitorOnBlockOutput::Reorg {
                    chain_id,
                    depth: reorg_depth,
                    from_block: block_number,
                });
            }
        }

        // Normal block: store hash and update height
        storage.put("blockHash", &block_key, json!({
            "chainId": chain_id,
            "blockNumber": block_number,
            "hash": block_hash,
        })).await?;

        let config = storage.get("chainConfig", &chain_key).await?;
        if let Some(mut config) = config {
            config["currentHeight"] = json!(block_number);
            storage.put("chainConfig", &chain_key, config).await?;
        }

        Ok(ChainMonitorOnBlockOutput::Ok {
            chain_id,
            block_number,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_await_finality_returns_pending() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        let result = handler.await_finality(
            ChainMonitorAwaitFinalityInput {
                tx_hash: "0xabc123".to_string(),
                level: "safe".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorAwaitFinalityOutput::Ok { chain, block, confirmations } => {
                assert_eq!(chain, "pending");
                assert_eq!(block, 0);
                assert_eq!(confirmations, 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_await_finality_empty_level_defaults() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        let result = handler.await_finality(
            ChainMonitorAwaitFinalityInput {
                tx_hash: "0xdef456".to_string(),
                level: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorAwaitFinalityOutput::Ok { chain, .. } => {
                assert_eq!(chain, "pending");
            }
            _ => panic!("Expected Ok variant"),
        }
        // Verify subscription stored with default level
        let sub = storage.get("subscriptions", "0xdef456").await.unwrap();
        assert!(sub.is_some());
        assert_eq!(sub.unwrap()["level"].as_str().unwrap(), "default");
    }

    #[tokio::test]
    async fn test_subscribe_stores_chain_config() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        let result = handler.subscribe(
            ChainMonitorSubscribeInput {
                chain_id: 1,
                rpc_url: "https://eth-mainnet.example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorSubscribeOutput::Ok { chain_id } => {
                assert_eq!(chain_id, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
        // Verify chain config was stored
        let config = storage.get("chainConfig", "1").await.unwrap();
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config["chainId"].as_i64().unwrap(), 1);
        assert_eq!(config["rpcUrl"].as_str().unwrap(), "https://eth-mainnet.example.com");
    }

    #[tokio::test]
    async fn test_on_block_normal_block() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        // Subscribe first to set up chain config
        handler.subscribe(
            ChainMonitorSubscribeInput {
                chain_id: 1,
                rpc_url: "https://rpc.example.com".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.on_block(
            ChainMonitorOnBlockInput {
                chain_id: 1,
                block_number: 100,
                block_hash: "0xblock100hash".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorOnBlockOutput::Ok { chain_id, block_number } => {
                assert_eq!(chain_id, 1);
                assert_eq!(block_number, 100);
            }
            _ => panic!("Expected Ok variant"),
        }
        // Verify block hash stored
        let block = storage.get("blockHash", "1:100").await.unwrap();
        assert!(block.is_some());
        assert_eq!(block.unwrap()["hash"].as_str().unwrap(), "0xblock100hash");
    }

    #[tokio::test]
    async fn test_on_block_updates_chain_height() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        handler.subscribe(
            ChainMonitorSubscribeInput {
                chain_id: 42,
                rpc_url: "https://rpc.example.com".to_string(),
            },
            &storage,
        ).await.unwrap();

        handler.on_block(
            ChainMonitorOnBlockInput {
                chain_id: 42,
                block_number: 500,
                block_hash: "0xhash500".to_string(),
            },
            &storage,
        ).await.unwrap();

        let config = storage.get("chainConfig", "42").await.unwrap().unwrap();
        assert_eq!(config["currentHeight"].as_i64().unwrap(), 500);
    }

    #[tokio::test]
    async fn test_on_block_reorg_detected() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        handler.subscribe(
            ChainMonitorSubscribeInput {
                chain_id: 1,
                rpc_url: "https://rpc.example.com".to_string(),
            },
            &storage,
        ).await.unwrap();

        // Process blocks 100, 101, 102
        for i in 100..=102 {
            handler.on_block(
                ChainMonitorOnBlockInput {
                    chain_id: 1,
                    block_number: i,
                    block_hash: format!("0xoriginal{}", i),
                },
                &storage,
            ).await.unwrap();
        }

        // Now submit block 101 with a different hash (reorg at depth 2: blocks 101, 102)
        let result = handler.on_block(
            ChainMonitorOnBlockInput {
                chain_id: 1,
                block_number: 101,
                block_hash: "0xreorged101".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorOnBlockOutput::Reorg { chain_id, depth, from_block } => {
                assert_eq!(chain_id, 1);
                assert_eq!(from_block, 101);
                assert_eq!(depth, 2); // blocks 101 and 102 invalidated
            }
            _ => panic!("Expected Reorg variant"),
        }
    }

    #[tokio::test]
    async fn test_on_block_same_hash_no_reorg() {
        let storage = InMemoryStorage::new();
        let handler = ChainMonitorHandlerImpl;
        handler.subscribe(
            ChainMonitorSubscribeInput {
                chain_id: 1,
                rpc_url: "https://rpc.example.com".to_string(),
            },
            &storage,
        ).await.unwrap();

        // Process block 200
        handler.on_block(
            ChainMonitorOnBlockInput {
                chain_id: 1,
                block_number: 200,
                block_hash: "0xhash200".to_string(),
            },
            &storage,
        ).await.unwrap();

        // Re-submit block 200 with same hash (no reorg)
        let result = handler.on_block(
            ChainMonitorOnBlockInput {
                chain_id: 1,
                block_number: 200,
                block_hash: "0xhash200".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChainMonitorOnBlockOutput::Ok { chain_id, block_number } => {
                assert_eq!(chain_id, 1);
                assert_eq!(block_number, 200);
            }
            _ => panic!("Expected Ok variant, not Reorg"),
        }
    }
}
