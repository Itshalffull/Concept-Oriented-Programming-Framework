// ============================================================
// File Role & Language Inference
//
// Infers a project file's role (source, generated, config, spec,
// doc, test, asset) and programming language from its path and
// extension. Used by FileArtifact/register for auto-classification.
//
// See design doc Section 4.1 (FileArtifact).
// ============================================================

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.rs': 'rust',
  '.swift': 'swift',
  '.sol': 'solidity',
  '.py': 'python',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  '.concept': 'concept-spec',
  '.sync': 'sync-spec',
};

const PATH_ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\.concept$/, role: 'spec' },
  { pattern: /\.sync$/, role: 'sync-spec' },
  { pattern: /kit\.yaml$/, role: 'spec' },
  { pattern: /generated\//, role: 'generated' },
  { pattern: /\.impl\.ts$/, role: 'source' },
  { pattern: /\.test\.[jt]sx?$/, role: 'test' },
  { pattern: /\.spec\.[jt]sx?$/, role: 'test' },
  { pattern: /\.md$/, role: 'doc' },
  { pattern: /README/, role: 'doc' },
  { pattern: /\.config\./, role: 'config' },
  { pattern: /tsconfig\.json$/, role: 'config' },
  { pattern: /package\.json$/, role: 'config' },
  { pattern: /vitest\.config/, role: 'config' },
  { pattern: /\.gitignore$/, role: 'config' },
  { pattern: /deploy\.yaml$/, role: 'config' },
  { pattern: /\.env/, role: 'config' },
  { pattern: /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/, role: 'asset' },
  { pattern: /\.wasm$/, role: 'asset' },
];

/** Infer the programming language from a file path's extension. */
export function inferLanguage(filePath: string): string | undefined {
  const ext = filePath.match(/\.[^./\\]+$/)?.[0];
  return ext ? EXTENSION_TO_LANGUAGE[ext] : undefined;
}

/**
 * Infer the project role of a file from its path.
 * Uses forward slashes internally for cross-platform matching.
 */
export function inferRole(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  for (const { pattern, role } of PATH_ROLE_PATTERNS) {
    if (pattern.test(normalized)) return role;
  }
  return 'source';
}
