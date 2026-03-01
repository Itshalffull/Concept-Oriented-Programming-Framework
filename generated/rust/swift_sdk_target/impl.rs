// Swift SDK target: generates a Swift Package with models, client, and Package.swift
// from a concept projection. Produces Codable structs, async/await client, and SPM manifest.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SwiftSdkTargetHandler;
use serde_json::json;

pub struct SwiftSdkTargetHandlerImpl;

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn clean_concept_name(projection: &str) -> String {
    projection
        .replace("-projection", "")
        .replace('-', "")
}

#[async_trait]
impl SwiftSdkTargetHandler for SwiftSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: SwiftSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let package_name = config["packageName"].as_str().unwrap_or("ClefSDK");
        let platforms: Vec<String> = config["platforms"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_else(|| vec!["iOS".to_string(), "macOS".to_string()]);

        let concept_name = clean_concept_name(&input.projection);
        let type_name = capitalize(&concept_name);

        // Generate models
        let models_content = format!(
            r#"// Generated models for {}
import Foundation

/// {} entity.
public struct {}: Codable, Identifiable, Sendable {{
    public let id: String
    public let name: String
    public let createdAt: Date
    public let updatedAt: Date
}}

/// Input for creating a {}.
public struct Create{}Input: Codable, Sendable {{
    public let name: String

    public init(name: String) {{
        self.name = name
    }}
}}

/// Input for updating a {}.
public struct Update{}Input: Codable, Sendable {{
    public let name: String?

    public init(name: String? = nil) {{
        self.name = name
    }}
}}"#, type_name, type_name, type_name, type_name, type_name, type_name, type_name);

        // Generate async client
        let client_content = format!(
            r#"// Generated client for {}
import Foundation

/// Client for {} operations.
public actor {}Client {{
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(baseURL: URL) {{
        self.baseURL = baseURL
        self.session = URLSession.shared
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }}

    public func create(_ input: Create{}Input) async -> Result<{}, Error> {{
        let url = baseURL.appendingPathComponent("{}")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try? encoder.encode(input)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {{
            let (data, _) = try await session.data(for: request)
            let result = try decoder.decode({}.self, from: data)
            return .success(result)
        }} catch {{
            return .failure(error)
        }}
    }}

    public func get(id: String) async -> Result<{}, Error> {{
        let url = baseURL.appendingPathComponent("{}/\(id)")
        do {{
            let (data, _) = try await session.data(from: url)
            let result = try decoder.decode({}.self, from: data)
            return .success(result)
        }} catch {{
            return .failure(error)
        }}
    }}

    public func list() async -> Result<[{}], Error> {{
        let url = baseURL.appendingPathComponent("{}")
        do {{
            let (data, _) = try await session.data(from: url)
            let result = try decoder.decode([{}].self, from: data)
            return .success(result)
        }} catch {{
            return .failure(error)
        }}
    }}
}}"#,
            type_name, type_name, type_name,
            type_name, type_name, concept_name, type_name,
            type_name, concept_name, type_name,
            type_name, concept_name, type_name);

        // Generate Package.swift
        let platforms_formatted: Vec<String> = platforms.iter().map(|p| {
            match p.to_lowercase().as_str() {
                "ios" => ".iOS(.v16)".to_string(),
                "macos" => ".macOS(.v13)".to_string(),
                "tvos" => ".tvOS(.v16)".to_string(),
                "watchos" => ".watchOS(.v9)".to_string(),
                _ => ".iOS(.v16)".to_string(),
            }
        }).collect();

        let package_swift = format!(
            r#"// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{}",
    platforms: [{}],
    products: [
        .library(name: "{}", targets: ["{}"]),
    ],
    targets: [
        .target(name: "{}", path: "Sources/{}"),
        .testTarget(name: "{}Tests", dependencies: ["{}"]),
    ]
)"#,
            package_name, platforms_formatted.join(", "),
            package_name, package_name,
            package_name, package_name,
            package_name, package_name);

        let files = vec![
            format!("Sources/{}/Models/{}.swift", package_name, type_name),
            format!("Sources/{}/{}Client.swift", package_name, type_name),
            "Package.swift".to_string(),
        ];

        let package_id = format!("swift-sdk-{}", concept_name);
        storage.put("package", &package_id, json!({
            "packageId": &package_id,
            "packageName": package_name,
            "projection": &input.projection,
            "files": &files,
        })).await?;

        Ok(SwiftSdkTargetGenerateOutput::Ok {
            package: package_id,
            files,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate() {
        let storage = InMemoryStorage::new();
        let handler = SwiftSdkTargetHandlerImpl;
        let result = handler.generate(
            SwiftSdkTargetGenerateInput {
                projection: "user-projection".to_string(),
                config: r#"{"packageName":"UserSDK","platforms":["iOS","macOS"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftSdkTargetGenerateOutput::Ok { package, files } => {
                assert!(package.contains("swift-sdk"));
                assert!(files.len() >= 2);
                assert!(files.iter().any(|f| f.contains("Package.swift")));
            },
        }
    }

    #[tokio::test]
    async fn test_generate_default_config() {
        let storage = InMemoryStorage::new();
        let handler = SwiftSdkTargetHandlerImpl;
        let result = handler.generate(
            SwiftSdkTargetGenerateInput {
                projection: "article-projection".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftSdkTargetGenerateOutput::Ok { package, files } => {
                assert!(!package.is_empty());
                assert!(!files.is_empty());
            },
        }
    }
}
