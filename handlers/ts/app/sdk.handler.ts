// @migrated dsl-constructs 2026-03-18
// Sdk Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const PACKAGE_MANIFESTS: Record<string, string> = { typescript: 'package.json', javascript: 'package.json', python: 'pyproject.toml', go: 'go.mod', rust: 'Cargo.toml', java: 'pom.xml', swift: 'Package.swift' };
const FILE_EXTENSIONS: Record<string, string> = { typescript: '.ts', javascript: '.js', python: '.py', go: '.go', rust: '.rs', java: '.java', swift: '.swift' };

const sdkHandlerFunctional: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const language = input.language as string;
    const config = input.config as string;

    let configData: Record<string, unknown>;
    try { configData = JSON.parse(config); } catch { configData = {}; }

    const ext = FILE_EXTENSIONS[language];
    if (!ext) {
      let p = createProgram();
      return complete(p, 'languageError', { language, reason: `Unsupported SDK language: ${language}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const packageName = (configData.packageName as string) ?? `@clef/sdk-${language}`;
    const version = (configData.version as string) ?? '1.0.0';
    const transport = (configData.transport as string) ?? 'http';
    const authStrategy = (configData.authStrategy as string) ?? null;
    const baseDir = `sdk/${language}`;
    const files: string[] = [`${baseDir}/client${ext}`, `${baseDir}/types${ext}`, `${baseDir}/transport${ext}`];
    if (authStrategy) files.push(`${baseDir}/auth${ext}`);
    const manifestFile = PACKAGE_MANIFESTS[language];
    if (manifestFile) files.push(`${baseDir}/${manifestFile}`);
    files.push(`${baseDir}/index${ext}`);

    let packageJson = '';
    if (language === 'typescript' || language === 'javascript') {
      packageJson = JSON.stringify({ name: packageName, version, main: `index${ext}`, types: language === 'typescript' ? 'index.d.ts' : undefined }, null, 2);
    } else if (language === 'python') { packageJson = `[project]\nname = "${packageName}"\nversion = "${version}"`; }
    else if (language === 'go') { packageJson = `module ${packageName}\n\ngo 1.21`; }
    else if (language === 'rust') { packageJson = `[package]\nname = "${packageName}"\nversion = "${version}"`; }
    else { packageJson = JSON.stringify({ name: packageName, version }); }

    const packageId = `sdk-${language}-${Date.now()}`;
    const now = new Date().toISOString();
    const fileManifest = files.map((f) => ({ path: f, hash: Math.abs(f.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)).toString(16) }));

    let p = createProgram();
    p = put(p, 'package', packageId, { packageId, language, packageName, version, transport, authStrategy: authStrategy ?? '', files: JSON.stringify(fileManifest), generatedAt: now, projection });
    return complete(p, 'ok', { package: packageId, files: JSON.stringify(files), packageJson }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  publish(input: Record<string, unknown>) {
    const packageId = input.package as string;
    const registry = input.registry as string;

    let p = createProgram();
    p = spGet(p, 'package', packageId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const knownRegistries = ['npm', 'pypi', 'crates.io', 'maven', 'go-proxy'];
        if (!knownRegistries.includes(registry)) {
          return complete(b, 'registryUnavailable', { registry });
        }
        let b2 = spGet(b, 'publish', `${packageId}::${registry}::`, 'alreadyPublished');
        // Simplified: just record the publication
        const now = new Date().toISOString();
        b2 = put(b2, 'publish', `${packageId}::${registry}::`, { packageId, registry, publishedAt: now });
        return complete(b2, 'ok', { package: packageId, publishedVersion: '' });
      },
      (b) => complete(b, 'registryUnavailable', { registry }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const sdkHandler = wrapFunctional(sdkHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { sdkHandlerFunctional };
