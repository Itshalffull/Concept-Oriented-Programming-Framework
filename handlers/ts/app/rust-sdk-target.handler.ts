// RustSdkTarget Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const rustSdkTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const crateName = (parsedConfig.crateName as string) || 'clef-sdk';
    const edition = (parsedConfig.edition as string) || '2021';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '_');
    const structName = conceptName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

    const typesFile = [
      `//! Types for ${structName} SDK`,
      ``,
      `use serde::{Deserialize, Serialize};`,
      ``,
      `/// ${structName} entity.`,
      `#[derive(Debug, Clone, Serialize, Deserialize)]`,
      `pub struct ${structName} {`,
      `    pub id: String,`,
      `    pub name: String,`,
      `    pub created_at: String,`,
      `    pub updated_at: String,`,
      `}`,
      ``,
      `/// Input for creating a ${structName}.`,
      `#[derive(Debug, Clone, Serialize, Deserialize)]`,
      `pub struct Create${structName}Input {`,
      `    pub name: String,`,
      `}`,
      ``,
      `/// Builder for Create${structName}Input.`,
      `pub struct Create${structName}InputBuilder {`,
      `    name: Option<String>,`,
      `}`,
      ``,
      `impl Create${structName}InputBuilder {`,
      `    pub fn new() -> Self {`,
      `        Self { name: None }`,
      `    }`,
      ``,
      `    pub fn name(mut self, name: impl Into<String>) -> Self {`,
      `        self.name = Some(name.into());`,
      `        self`,
      `    }`,
      ``,
      `    pub fn build(self) -> Result<Create${structName}Input, String> {`,
      `        Ok(Create${structName}Input {`,
      `            name: self.name.ok_or("name is required")?,`,
      `        })`,
      `    }`,
      `}`,
      ``,
      `/// Input for updating a ${structName}.`,
      `#[derive(Debug, Clone, Serialize, Deserialize)]`,
      `pub struct Update${structName}Input {`,
      `    pub name: Option<String>,`,
      `}`,
      ``,
      `/// Result variants for ${structName} operations.`,
      `#[derive(Debug)]`,
      `pub enum ${structName}Result {`,
      `    Ok(${structName}),`,
      `    NotFound(String),`,
      `    Error(String),`,
      `}`,
    ].join('\n');

    const clientFile = [
      `//! Client for ${structName} SDK`,
      ``,
      `use crate::types::*;`,
      `use reqwest::Client as HttpClient;`,
      ``,
      `/// Client for ${structName} operations.`,
      `pub struct ${structName}Client {`,
      `    base_url: String,`,
      `    http: HttpClient,`,
      `}`,
      ``,
      `impl ${structName}Client {`,
      `    /// Create a new client.`,
      `    pub fn new(base_url: impl Into<String>) -> Self {`,
      `        Self {`,
      `            base_url: base_url.into(),`,
      `            http: HttpClient::new(),`,
      `        }`,
      `    }`,
      ``,
      `    /// Create a new ${structName}.`,
      `    pub async fn create(&self, input: Create${structName}Input) -> Result<${structName}, reqwest::Error> {`,
      `        let url = format!("{}/{}", self.base_url, "${conceptName}");`,
      `        let response = self.http.post(&url).json(&input).send().await?;`,
      `        response.json().await`,
      `    }`,
      ``,
      `    /// Get a ${structName} by ID.`,
      `    pub async fn get(&self, id: &str) -> Result<${structName}, reqwest::Error> {`,
      `        let url = format!("{}/{}/{}", self.base_url, "${conceptName}", id);`,
      `        let response = self.http.get(&url).send().await?;`,
      `        response.json().await`,
      `    }`,
      ``,
      `    /// List all ${structName} entries.`,
      `    pub async fn list(&self) -> Result<Vec<${structName}>, reqwest::Error> {`,
      `        let url = format!("{}/{}", self.base_url, "${conceptName}");`,
      `        let response = self.http.get(&url).send().await?;`,
      `        response.json().await`,
      `    }`,
      ``,
      `    /// Update a ${structName}.`,
      `    pub async fn update(&self, id: &str, input: Update${structName}Input) -> Result<${structName}, reqwest::Error> {`,
      `        let url = format!("{}/{}/{}", self.base_url, "${conceptName}", id);`,
      `        let response = self.http.put(&url).json(&input).send().await?;`,
      `        response.json().await`,
      `    }`,
      ``,
      `    /// Delete a ${structName}.`,
      `    pub async fn delete(&self, id: &str) -> Result<(), reqwest::Error> {`,
      `        let url = format!("{}/{}/{}", self.base_url, "${conceptName}", id);`,
      `        self.http.delete(&url).send().await?;`,
      `        Ok(())`,
      `    }`,
      `}`,
    ].join('\n');

    const libFile = [
      `//! ${crateName} - Generated Rust SDK`,
      ``,
      `pub mod client;`,
      `pub mod types;`,
      ``,
      `pub use client::${structName}Client;`,
      `pub use types::*;`,
    ].join('\n');

    const cargoFile = [
      `[package]`,
      `name = "${crateName}"`,
      `version = "1.0.0"`,
      `edition = "${edition}"`,
      ``,
      `[dependencies]`,
      `reqwest = { version = "0.11", features = ["json"] }`,
      `serde = { version = "1.0", features = ["derive"] }`,
      `serde_json = "1.0"`,
      `tokio = { version = "1", features = ["full"] }`,
    ].join('\n');

    const files = [
      `src/lib.rs`,
      `src/client.rs`,
      `src/types.rs`,
      `Cargo.toml`,
    ];

    const crateId = `rust-sdk-${conceptName}-${Date.now()}`;

    await storage.put('crate', crateId, {
      crateId,
      crateName,
      edition,
      projection,
      config,
      files: JSON.stringify(files),
      typesFile,
      clientFile,
      libFile,
      cargoFile,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      crate: crateId,
      files,
    };
  },
};
