// Content Digest -- compute and compare content digests for deduplication
// Supports multiple hash algorithms and equivalence checking between content units.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentDigestHandler;
use serde_json::json;

pub struct ContentDigestHandlerImpl;

const SUPPORTED_ALGORITHMS: &[&str] = &["sha256", "sha1", "md5", "fnv64"];

/// Compute a digest using a simple hash function (real impl would use crypto crate)
fn compute_digest(data: &str, algorithm: &str) -> String {
    let mut hash: u64 = match algorithm {
        "sha256" => 0x6a09e667f3bcc908,
        "sha1" => 0x67452301efcdab89,
        "md5" => 0x67452301,
        _ => 0xcbf29ce484222325,
    };
    for byte in data.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{}:{:016x}", algorithm, hash)
}

#[async_trait]
impl ContentDigestHandler for ContentDigestHandlerImpl {
    async fn compute(
        &self,
        input: ContentDigestComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestComputeOutput, Box<dyn std::error::Error>> {
        if !SUPPORTED_ALGORITHMS.contains(&input.algorithm.as_str()) {
            return Ok(ContentDigestComputeOutput::UnsupportedAlgorithm {
                algorithm: input.algorithm,
            });
        }

        let digest = compute_digest(&input.unit, &input.algorithm);

        // Store the digest for later lookup
        storage.put("digest", &digest, json!({
            "digest": digest,
            "unit": input.unit,
            "algorithm": input.algorithm,
        })).await?;

        Ok(ContentDigestComputeOutput::Ok { digest })
    }

    async fn lookup(
        &self,
        input: ContentDigestLookupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestLookupOutput, Box<dyn std::error::Error>> {
        let record = storage.get("digest", &input.hash).await?;
        match record {
            Some(r) => {
                let units = r["unit"].as_str().unwrap_or("").to_string();
                Ok(ContentDigestLookupOutput::Ok { units })
            }
            None => Ok(ContentDigestLookupOutput::Notfound),
        }
    }

    async fn equivalent(
        &self,
        input: ContentDigestEquivalentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestEquivalentOutput, Box<dyn std::error::Error>> {
        // Compute digests for both inputs using the default algorithm
        let digest_a = compute_digest(&input.a, "sha256");
        let digest_b = compute_digest(&input.b, "sha256");

        // Store both digests
        storage.put("digest", &digest_a, json!({
            "digest": digest_a,
            "unit": input.a,
            "algorithm": "sha256",
        })).await?;
        storage.put("digest", &digest_b, json!({
            "digest": digest_b,
            "unit": input.b,
            "algorithm": "sha256",
        })).await?;

        if digest_a == digest_b {
            Ok(ContentDigestEquivalentOutput::Yes)
        } else {
            Ok(ContentDigestEquivalentOutput::No {
                diff_summary: format!("Digests differ: {} vs {}", digest_a, digest_b),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compute_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentDigestHandlerImpl;
        let result = handler.compute(
            ContentDigestComputeInput {
                unit: "hello world".to_string(),
                algorithm: "sha256".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentDigestComputeOutput::Ok { digest } => {
                assert!(digest.starts_with("sha256:"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compute_unsupported_algorithm() {
        let storage = InMemoryStorage::new();
        let handler = ContentDigestHandlerImpl;
        let result = handler.compute(
            ContentDigestComputeInput {
                unit: "hello".to_string(),
                algorithm: "blake3".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentDigestComputeOutput::UnsupportedAlgorithm { algorithm } => {
                assert_eq!(algorithm, "blake3");
            },
            _ => panic!("Expected UnsupportedAlgorithm variant"),
        }
    }

    #[tokio::test]
    async fn test_lookup_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentDigestHandlerImpl;
        let result = handler.lookup(
            ContentDigestLookupInput { hash: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentDigestLookupOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_equivalent_yes() {
        let storage = InMemoryStorage::new();
        let handler = ContentDigestHandlerImpl;
        let result = handler.equivalent(
            ContentDigestEquivalentInput {
                a: "hello".to_string(),
                b: "hello".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentDigestEquivalentOutput::Yes => {},
            _ => panic!("Expected Yes variant"),
        }
    }

    #[tokio::test]
    async fn test_equivalent_no() {
        let storage = InMemoryStorage::new();
        let handler = ContentDigestHandlerImpl;
        let result = handler.equivalent(
            ContentDigestEquivalentInput {
                a: "hello".to_string(),
                b: "world".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentDigestEquivalentOutput::No { diff_summary } => {
                assert!(diff_summary.contains("differ"));
            },
            _ => panic!("Expected No variant"),
        }
    }
}
