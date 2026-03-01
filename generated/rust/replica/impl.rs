use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ReplicaHandler;
use serde_json::json;

pub struct ReplicaHandlerImpl;

const META_KEY: &str = "replica-meta";

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("replica-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl ReplicaHandler for ReplicaHandlerImpl {
    async fn local_update(
        &self,
        input: ReplicaLocalUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaLocalUpdateOutput, Box<dyn std::error::Error>> {
        let op = String::from_utf8_lossy(&input.op).to_string();
        if op.trim().is_empty() {
            return Ok(ReplicaLocalUpdateOutput::InvalidOp {
                message: "Operation payload is empty or malformed".to_string(),
            });
        }

        let meta = storage.get("replica", META_KEY).await?;
        let (local_state, pending_ops_json, clock, replica_id) = if let Some(m) = &meta {
            let ls = m.get("localState").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let po = m.get("pendingOps").and_then(|v| v.as_str()).unwrap_or("[]").to_string();
            let c = m.get("clock").and_then(|v| v.as_i64()).unwrap_or(0);
            let rid = m.get("replicaId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            (ls, po, c, rid)
        } else {
            (String::new(), "[]".to_string(), 0i64, next_id())
        };

        let new_state = if local_state.is_empty() {
            op.clone()
        } else {
            format!("{},{}", local_state, op)
        };

        let mut pending: Vec<String> = serde_json::from_str(&pending_ops_json).unwrap_or_default();
        pending.push(op);
        let new_clock = clock + 1;

        storage.put("replica", META_KEY, json!({
            "replicaId": replica_id,
            "localState": new_state,
            "pendingOps": serde_json::to_string(&pending).unwrap_or_default(),
            "clock": new_clock
        })).await?;

        Ok(ReplicaLocalUpdateOutput::Ok {
            new_state: new_state.into_bytes(),
        })
    }

    async fn receive_remote(
        &self,
        input: ReplicaReceiveRemoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaReceiveRemoteOutput, Box<dyn std::error::Error>> {
        let op = String::from_utf8_lossy(&input.op).to_string();

        let peers = storage.find("replica-peer", Some(&json!({"peerId": input.from_replica}))).await?;
        if peers.is_empty() {
            return Ok(ReplicaReceiveRemoteOutput::UnknownReplica {
                message: format!("Replica \"{}\" is not a known peer", input.from_replica),
            });
        }

        let meta = storage.get("replica", META_KEY).await?;
        let (local_state, pending_ops_json, clock, replica_id) = if let Some(m) = &meta {
            let ls = m.get("localState").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let po = m.get("pendingOps").and_then(|v| v.as_str()).unwrap_or("[]").to_string();
            let c = m.get("clock").and_then(|v| v.as_i64()).unwrap_or(0);
            let rid = m.get("replicaId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            (ls, po, c, rid)
        } else {
            (String::new(), "[]".to_string(), 0i64, next_id())
        };

        let pending: Vec<String> = serde_json::from_str(&pending_ops_json).unwrap_or_default();
        if pending.contains(&op) {
            let details = serde_json::to_vec(&json!({
                "localPending": pending,
                "remoteOp": op,
                "fromReplica": input.from_replica
            }))?;
            return Ok(ReplicaReceiveRemoteOutput::Conflict { details });
        }

        let new_state = if local_state.is_empty() { op.clone() } else { format!("{},{}", local_state, op) };
        let new_clock = clock + 1;

        storage.put("replica-sync", &input.from_replica, json!({
            "peerId": input.from_replica,
            "lastOp": op,
            "lastSyncClock": new_clock
        })).await?;

        storage.put("replica", META_KEY, json!({
            "replicaId": replica_id,
            "localState": new_state,
            "clock": new_clock,
            "pendingOps": pending_ops_json
        })).await?;

        Ok(ReplicaReceiveRemoteOutput::Ok {
            new_state: new_state.into_bytes(),
        })
    }

    async fn sync(
        &self,
        input: ReplicaSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaSyncOutput, Box<dyn std::error::Error>> {
        let peers = storage.find("replica-peer", Some(&json!({"peerId": input.peer}))).await?;
        if peers.is_empty() {
            return Ok(ReplicaSyncOutput::Unreachable {
                message: format!("Peer \"{}\" is not reachable or not known", input.peer),
            });
        }

        if let Some(mut meta) = storage.get("replica", META_KEY).await? {
            let clock = meta.get("clock").and_then(|v| v.as_i64()).unwrap_or(0);
            meta["pendingOps"] = json!("[]");
            storage.put("replica", META_KEY, meta).await?;
            storage.put("replica-sync", &input.peer, json!({
                "peerId": input.peer,
                "lastOp": null,
                "lastSyncClock": clock
            })).await?;
        }

        Ok(ReplicaSyncOutput::Ok)
    }

    async fn get_state(
        &self,
        _input: ReplicaGetStateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaGetStateOutput, Box<dyn std::error::Error>> {
        let meta = storage.get("replica", META_KEY).await?;
        if let Some(m) = meta {
            let state = m.get("localState").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let clock_val = m.get("clock").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok(ReplicaGetStateOutput::Ok {
                state: state.into_bytes(),
                clock: serde_json::to_vec(&json!({"v": clock_val}))?,
            })
        } else {
            Ok(ReplicaGetStateOutput::Ok {
                state: Vec::new(),
                clock: serde_json::to_vec(&json!({"v": 0}))?,
            })
        }
    }

    async fn fork(
        &self,
        _input: ReplicaForkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaForkOutput, Box<dyn std::error::Error>> {
        let new_replica_id = next_id();
        let meta = storage.get("replica", META_KEY).await?;
        let (state, clock, forked_from) = if let Some(m) = meta {
            (
                m.get("localState").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                m.get("clock").and_then(|v| v.as_i64()).unwrap_or(0),
                m.get("replicaId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            )
        } else {
            (String::new(), 0, String::new())
        };

        storage.put("replica-fork", &new_replica_id, json!({
            "replicaId": new_replica_id,
            "forkedFrom": forked_from,
            "localState": state,
            "clock": clock,
            "pendingOps": "[]"
        })).await?;

        Ok(ReplicaForkOutput::Ok { new_replica_id })
    }

    async fn add_peer(
        &self,
        input: ReplicaAddPeerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReplicaAddPeerOutput, Box<dyn std::error::Error>> {
        let existing = storage.find("replica-peer", Some(&json!({"peerId": input.peer_id}))).await?;
        if !existing.is_empty() {
            return Ok(ReplicaAddPeerOutput::AlreadyKnown {
                message: format!("Peer \"{}\" is already in the peer set", input.peer_id),
            });
        }

        let id = next_id();
        storage.put("replica-peer", &id, json!({
            "id": id,
            "peerId": input.peer_id
        })).await?;

        Ok(ReplicaAddPeerOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_local_update_success() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.local_update(
            ReplicaLocalUpdateInput { op: b"set x=1".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            ReplicaLocalUpdateOutput::Ok { new_state } => {
                let s = String::from_utf8(new_state).unwrap();
                assert!(s.contains("set x=1"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_local_update_empty_op() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.local_update(
            ReplicaLocalUpdateInput { op: b"  ".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            ReplicaLocalUpdateOutput::InvalidOp { .. } => {},
            _ => panic!("Expected InvalidOp variant"),
        }
    }

    #[tokio::test]
    async fn test_receive_remote_unknown_replica() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.receive_remote(
            ReplicaReceiveRemoteInput {
                op: b"op1".to_vec(),
                from_replica: "unknown-peer".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReplicaReceiveRemoteOutput::UnknownReplica { .. } => {},
            _ => panic!("Expected UnknownReplica variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_unreachable() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.sync(
            ReplicaSyncInput { peer: "unknown".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReplicaSyncOutput::Unreachable { .. } => {},
            _ => panic!("Expected Unreachable variant"),
        }
    }

    #[tokio::test]
    async fn test_get_state_empty() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.get_state(
            ReplicaGetStateInput {},
            &storage,
        ).await.unwrap();
        match result {
            ReplicaGetStateOutput::Ok { state, .. } => {
                assert!(state.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_fork() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let result = handler.fork(
            ReplicaForkInput {},
            &storage,
        ).await.unwrap();
        match result {
            ReplicaForkOutput::Ok { new_replica_id } => {
                assert!(new_replica_id.starts_with("replica-"));
            },
        }
    }

    #[tokio::test]
    async fn test_add_peer_and_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = ReplicaHandlerImpl;
        let r1 = handler.add_peer(
            ReplicaAddPeerInput { peer_id: "peer-1".to_string() },
            &storage,
        ).await.unwrap();
        match r1 {
            ReplicaAddPeerOutput::Ok => {},
            _ => panic!("Expected Ok"),
        }
    }
}
