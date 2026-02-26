// Sdk Concept Implementation (Clef Bind)
import type { ConceptHandler } from '@clef/runtime';

/** Map of language to package manifest filename. */
const PACKAGE_MANIFESTS: Record<string, string> = {
  typescript: 'package.json',
  javascript: 'package.json',
  python: 'pyproject.toml',
  go: 'go.mod',
  rust: 'Cargo.toml',
  java: 'pom.xml',
  swift: 'Package.swift',
};

/** Map of language to file extension. */
const FILE_EXTENSIONS: Record<string, string> = {
  typescript: '.ts',
  javascript: '.js',
  python: '.py',
  go: '.go',
  rust: '.rs',
  java: '.java',
  swift: '.swift',
};

export const sdkHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const language = input.language as string;
    const config = input.config as string;

    // Parse config
    let configData: Record<string, unknown>;
    try {
      configData = JSON.parse(config);
    } catch {
      configData = {};
    }

    const ext = FILE_EXTENSIONS[language];
    if (!ext) {
      return {
        variant: 'languageError',
        language,
        reason: `Unsupported SDK language: ${language}`,
      };
    }

    const packageName = (configData.packageName as string) ?? `@clef/sdk-${language}`;
    const version = (configData.version as string) ?? '1.0.0';
    const transport = (configData.transport as string) ?? 'http';
    const authStrategy = (configData.authStrategy as string) ?? null;

    // Generate file list based on projection
    const files: string[] = [];
    const baseDir = `sdk/${language}`;

    // Core client file
    files.push(`${baseDir}/client${ext}`);
    // Types file
    files.push(`${baseDir}/types${ext}`);
    // Transport layer
    files.push(`${baseDir}/transport${ext}`);
    // Auth helper (if auth strategy configured)
    if (authStrategy) {
      files.push(`${baseDir}/auth${ext}`);
    }
    // Package manifest
    const manifestFile = PACKAGE_MANIFESTS[language];
    if (manifestFile) {
      files.push(`${baseDir}/${manifestFile}`);
    }
    // Index / entry point
    files.push(`${baseDir}/index${ext}`);

    // Build package manifest content
    let packageJson = '';
    if (language === 'typescript' || language === 'javascript') {
      packageJson = JSON.stringify({
        name: packageName,
        version,
        main: `index${ext}`,
        types: language === 'typescript' ? 'index.d.ts' : undefined,
      }, null, 2);
    } else if (language === 'python') {
      packageJson = `[project]\nname = "${packageName}"\nversion = "${version}"`;
    } else if (language === 'go') {
      packageJson = `module ${packageName}\n\ngo 1.21`;
    } else if (language === 'rust') {
      packageJson = `[package]\nname = "${packageName}"\nversion = "${version}"`;
    } else {
      packageJson = JSON.stringify({ name: packageName, version });
    }

    const packageId = `sdk-${language}-${Date.now()}`;
    const now = new Date().toISOString();

    // Compute hashes for files
    const fileManifest = files.map((f) => ({
      path: f,
      hash: Math.abs(f.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)).toString(16),
    }));

    await storage.put('package', packageId, {
      packageId,
      language,
      packageName,
      version,
      transport,
      authStrategy: authStrategy ?? '',
      files: JSON.stringify(fileManifest),
      generatedAt: now,
      projection,
    });

    return {
      variant: 'ok',
      package: packageId,
      files: JSON.stringify(files),
      packageJson,
    };
  },

  async publish(input, storage) {
    const packageId = input.package as string;
    const registry = input.registry as string;

    const existing = await storage.get('package', packageId);
    if (!existing) {
      return {
        variant: 'registryUnavailable',
        registry,
      };
    }

    const version = existing.version as string;

    // Check if version already published
    const publishKey = `${packageId}::${registry}::${version}`;
    const alreadyPublished = await storage.get('publish', publishKey);
    if (alreadyPublished) {
      return { variant: 'versionExists', package: packageId, version };
    }

    // Simulate registry availability check
    const knownRegistries = ['npm', 'pypi', 'crates.io', 'maven', 'go-proxy'];
    if (!knownRegistries.includes(registry)) {
      return { variant: 'registryUnavailable', registry };
    }

    // Record publication
    const now = new Date().toISOString();
    await storage.put('publish', publishKey, {
      packageId,
      registry,
      version,
      publishedAt: now,
    });

    return { variant: 'ok', package: packageId, publishedVersion: version };
  },
};
