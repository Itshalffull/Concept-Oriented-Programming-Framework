import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['crypto'],
  outputFileTracingRoot: monorepoRoot,
  webpack: (config) => {
    config.resolve.symlinks = true;

    config.resolve.modules = [
      ...(config.resolve.modules || []),
      monorepoRoot,
    ];

    if (!config.resolve.extensions.includes('.ts')) {
      config.resolve.extensions.push('.ts', '.tsx');
    }

    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    const ruleOneOf = config.module.rules.find((r) => r.oneOf);
    if (ruleOneOf?.oneOf) {
      for (const rule of ruleOneOf.oneOf) {
        if (rule.include && !Array.isArray(rule.include)) {
          rule.include = [rule.include, monorepoRoot];
        } else if (Array.isArray(rule.include)) {
          rule.include.push(monorepoRoot);
        }
      }
    }

    return config;
  },
};

export default nextConfig;
