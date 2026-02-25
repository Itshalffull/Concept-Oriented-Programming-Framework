// RustToolchain Concept Implementation
// Rust provider for the Toolchain coordination concept. Manages
// rustup channels, target triple installation, and wasm-pack detection.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'rust-tool';

export const rustToolchainHandler: ConceptHandler = {
  async resolve(input, storage) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    // Check if a toolchain for this platform already exists in storage
    const existing = await storage.find(RELATION, { platform });
    if (existing.length > 0) {
      const rec = existing[0];
      return {
        variant: 'ok',
        toolchain: rec.toolchain as string,
        rustcPath: rec.rustcPath as string,
        version: rec.version as string,
        capabilities: JSON.parse(rec.capabilities as string),
      };
    }

    if (!platform) {
      return {
        variant: 'targetMissing',
        target: 'unknown',
        installHint: 'Platform must be specified to determine target triple',
      };
    }

    if (platform.startsWith('wasm') && versionConstraint === 'nightly') {
      return {
        variant: 'targetMissing',
        target: platform,
        installHint: `rustup target add ${platform} --toolchain nightly`,
      };
    }

    // Simulate rustc not installed for unknown platforms
    if (platform !== 'x86_64-linux' && platform !== 'aarch64-macos' && platform !== 'wasm32') {
      return {
        variant: 'notInstalled',
        installHint: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh',
      };
    }

    const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rustcPath = '/usr/local/bin/rustc';
    const version = '1.78.0';
    const capabilities = ['incremental', 'proc-macros', 'wasm-target'];

    await storage.put(RELATION, toolchainId, {
      toolchain: toolchainId,
      platform,
      versionConstraint: versionConstraint || '',
      rustcPath,
      version,
      capabilities: JSON.stringify(capabilities),
      resolvedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      toolchain: toolchainId,
      rustcPath,
      version,
      capabilities,
    };
  },

  async register(_input, _storage) {
    return {
      variant: 'ok',
      name: 'RustToolchain',
      language: 'rust',
      capabilities: ['rustup-channels', 'target-management', 'wasm-pack-detection'],
    };
  },
};
