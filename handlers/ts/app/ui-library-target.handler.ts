// UILibraryTarget Concept Implementation
//
// Generates docs/reference/ui-library.md from typed manifests:
// WidgetManifest and ThemeManifest. Organizes widgets by their
// nearest suite or directory group.
//
// Scans the entire project root for .widget and .theme files.
// Groups by nearest suite.yaml ancestor. Works with any project
// directory structure.
import type { ConceptHandler } from '@clef/runtime';
import type { WidgetManifest, ThemeManifest } from '../../../runtime/types.js';
import { parseWidgetFile } from '../framework/widget-spec-parser.js';
import { parseThemeFile } from '../framework/theme-spec-parser.js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename, relative, dirname } from 'path';

// ---------------------------------------------------------------------------
// File discovery — scans entire project, skips build/vendor dirs
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude', 'dist', 'build', 'out',
  '.next', '.turbo', 'coverage', '__pycache__',
]);

function globRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...globRecursive(full, ext));
      } else if (entry.endsWith(ext)) {
        results.push(full);
      }
    } catch {
      // skip inaccessible entries
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Suite discovery — lightweight YAML extraction
// ---------------------------------------------------------------------------

interface SuiteLite {
  name: string;
  dir: string;
  relPath: string;
}

function parseSuiteName(source: string, dirName: string): string {
  const nameMatch = source.match(/name:\s*(.+)/);
  return nameMatch ? nameMatch[1].trim() : dirName;
}

function findNearestSuiteDir(
  filePath: string,
  suitesByDir: Map<string, SuiteLite>,
): SuiteLite | null {
  let dir = dirname(filePath);
  const seen = new Set<string>();
  while (dir && !seen.has(dir)) {
    seen.add(dir);
    if (suitesByDir.has(dir)) return suitesByDir.get(dir)!;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const uiLibraryTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const config = JSON.parse((input.config as string) || '{}');
    const outputPath = (config.outputPath as string) || 'docs/reference/ui-library.md';
    const projectRoot = (config.projectRoot as string) || process.cwd();

    // ---- Discover all suite.yaml files ----
    const suiteYamlFiles = globRecursive(projectRoot, 'suite.yaml');
    const suitesByDir = new Map<string, SuiteLite>();
    for (const f of suiteYamlFiles) {
      try {
        const dir = dirname(f);
        const relPath = relative(projectRoot, dir).replace(/\\/g, '/');
        const name = parseSuiteName(readFileSync(f, 'utf-8'), basename(dir));
        suitesByDir.set(dir, { name, dir, relPath });
      } catch { /* skip */ }
    }

    // ---- Discover all theme files ----
    const themeFiles = globRecursive(projectRoot, '.theme');
    const themes: ThemeManifest[] = [];
    for (const f of themeFiles) {
      try {
        themes.push(parseThemeFile(readFileSync(f, 'utf-8')));
      } catch { /* skip */ }
    }

    // ---- Discover all widget files, grouped by nearest suite or directory ----
    const widgetFiles = globRecursive(projectRoot, '.widget');
    const widgetsByGroup = new Map<string, { label: string; relPath: string; widgets: WidgetManifest[] }>();

    for (const f of widgetFiles) {
      let groupKey: string;
      let label: string;
      let relPath: string;

      const suite = findNearestSuiteDir(f, suitesByDir);
      if (suite) {
        groupKey = suite.dir;
        label = suite.name;
        relPath = suite.relPath;
      } else {
        // Group by parent directory relative to root
        const fileRelDir = relative(projectRoot, dirname(f)).replace(/\\/g, '/');
        // Use up to 2 levels for grouping: "repertoire/widgets/domain" -> "widgets/domain"
        const parts = fileRelDir.split('/');
        // Find meaningful group name — skip the first part if it's a top-level container
        if (parts.length >= 2) {
          groupKey = parts.slice(0, 2).join('/');
          label = parts.slice(0, 2).join('/');
        } else {
          groupKey = fileRelDir;
          label = fileRelDir;
        }
        relPath = fileRelDir;
      }

      if (!widgetsByGroup.has(groupKey)) {
        widgetsByGroup.set(groupKey, { label, relPath, widgets: [] });
      }

      try {
        widgetsByGroup.get(groupKey)!.widgets.push(parseWidgetFile(readFileSync(f, 'utf-8')));
      } catch { /* skip */ }
    }

    const sortedGroups = [...widgetsByGroup.entries()]
      .filter(([, g]) => g.widgets.length > 0)
      .sort((a, b) => a[1].label.localeCompare(b[1].label));

    const totalWidgets = sortedGroups.reduce((n, [, g]) => n + g.widgets.length, 0);

    // ---- Render markdown ----
    const md: string[] = [];
    md.push('# UI Library Reference');
    md.push('');
    md.push(`> Auto-generated by UILibraryTarget — ${totalWidgets} widgets, ${themes.length} themes across ${sortedGroups.length} groups`);
    md.push('');

    // Table of contents
    md.push('## Table of Contents');
    md.push('');
    if (themes.length) md.push('- [Themes](#themes)');
    md.push('- [Widgets](#widgets)');
    for (const [, group] of sortedGroups) {
      const slug = group.label.replace(/[\s/]+/g, '-').toLowerCase();
      md.push(`  - [${group.label}](#${slug}) — ${group.widgets.length} widgets`);
    }
    md.push('- [Affordance Index](#affordance-index)');
    md.push('- [Accessibility Summary](#accessibility-summary)');
    md.push('');

    // Themes
    if (themes.length) {
      md.push('## Themes');
      md.push('');

      const sorted = [...themes].sort((a, b) => {
        if (!a.extends && b.extends) return -1;
        if (a.extends && !b.extends) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const theme of sorted) {
        const ext = theme.extends ? ` _(extends ${theme.extends})_` : ' _(base)_';
        md.push(`### ${theme.name}${ext}`);
        md.push('');
        const paletteKeys = Object.keys(theme.palette);
        if (paletteKeys.length) md.push(`**Palette** (${paletteKeys.length} tokens): ${paletteKeys.slice(0, 10).join(', ')}${paletteKeys.length > 10 ? ', ...' : ''}`);
        const typoKeys = Object.keys(theme.typography);
        if (typoKeys.length) md.push(`**Typography** (${typoKeys.length} tokens): ${typoKeys.slice(0, 8).join(', ')}${typoKeys.length > 8 ? ', ...' : ''}`);
        const spacingKeys = Object.keys(theme.spacing.scale);
        if (spacingKeys.length) md.push(`**Spacing** (${spacingKeys.length} tokens${theme.spacing.unit ? ', base: ' + theme.spacing.unit : ''}): ${spacingKeys.slice(0, 8).join(', ')}${spacingKeys.length > 8 ? ', ...' : ''}`);
        const motionKeys = Object.keys(theme.motion);
        if (motionKeys.length) md.push(`**Motion** (${motionKeys.length} tokens): ${motionKeys.slice(0, 6).join(', ')}${motionKeys.length > 6 ? ', ...' : ''}`);
        const elevKeys = Object.keys(theme.elevation);
        if (elevKeys.length) md.push(`**Elevation** (${elevKeys.length} tokens): ${elevKeys.slice(0, 6).join(', ')}${elevKeys.length > 6 ? ', ...' : ''}`);
        const radKeys = Object.keys(theme.radius);
        if (radKeys.length) md.push(`**Radius** (${radKeys.length} tokens): ${radKeys.slice(0, 6).join(', ')}${radKeys.length > 6 ? ', ...' : ''}`);
        md.push('');
      }
    }

    // Widgets by group
    md.push('## Widgets');
    md.push('');

    for (const [, group] of sortedGroups) {
      md.push(`### ${group.label}`);
      md.push(`\`${group.relPath}\``);
      md.push('');

      for (const w of group.widgets.sort((a, b) => a.name.localeCompare(b.name))) {
        md.push(`#### ${w.name}`);
        md.push('');
        if (w.purpose) {
          md.push(`> ${w.purpose}`);
          md.push('');
        }

        if (w.anatomy.length) {
          md.push(`**Anatomy**: ${w.anatomy.map((p) => p.name).join(' → ')}`);
          md.push('');
        }

        if (w.states.length) {
          md.push('**States**:');
          for (const s of w.states) {
            const tag = s.initial ? ' _(initial)_' : '';
            const trans = s.transitions.length
              ? `: ${s.transitions.map((t) => `${t.event} → ${t.target}`).join(', ')}`
              : '';
            md.push(`- \`${s.name}\`${tag}${trans}`);
          }
          md.push('');
        }

        if (w.accessibility.role || w.accessibility.keyboard.length) {
          md.push('**Accessibility**:');
          if (w.accessibility.role) md.push(`- Role: \`${w.accessibility.role}\``);
          if (w.accessibility.keyboard.length) {
            md.push('- Keyboard:');
            for (const k of w.accessibility.keyboard) {
              md.push(`  - ${k.key}: ${k.action}`);
            }
          }
          if (w.accessibility.focus.trap) md.push('- Focus: trapped');
          if (w.accessibility.focus.roving) md.push('- Focus: roving');
          md.push('');
        }

        if (w.affordance) {
          md.push('**Affordance**:');
          md.push(`- Serves: \`${w.affordance.serves}\``);
          if (w.affordance.specificity != null) md.push(`- Specificity: ${w.affordance.specificity}`);
          if (w.affordance.when) md.push(`- When: ${w.affordance.when}`);
          if (w.affordance.binds.length) {
            md.push('- Binds:');
            for (const b of w.affordance.binds) {
              md.push(`  - ${b.field}: ${b.source}`);
            }
          }
          md.push('');
        }

        if (w.props.length) {
          md.push('**Props**:');
          for (const p of w.props) {
            const def = p.defaultValue ? ` (default: ${p.defaultValue})` : '';
            md.push(`- \`${p.name}: ${p.type}\`${def}`);
          }
          md.push('');
        }
      }
    }

    // Affordance index
    md.push('---');
    md.push('');
    md.push('## Affordance Index');
    md.push('');
    md.push('| Widget | Group | Serves | Specificity | Binds To |');
    md.push('|--------|-------|--------|-------------|----------|');
    for (const [, group] of sortedGroups) {
      for (const w of group.widgets.sort((a, b) => a.name.localeCompare(b.name))) {
        if (w.affordance) {
          const bindsTo =
            w.affordance.when ||
            w.affordance.binds.map((b) => b.field).join(', ') ||
            '—';
          md.push(
            `| ${w.name} | ${group.label} | ${w.affordance.serves} | ${w.affordance.specificity ?? '—'} | ${bindsTo} |`,
          );
        }
      }
    }
    md.push('');

    // Accessibility summary
    md.push('## Accessibility Summary');
    md.push('');
    const roles = new Map<string, string[]>();
    const kbPatterns = new Map<string, number>();
    for (const [, group] of sortedGroups) {
      for (const w of group.widgets) {
        if (w.accessibility.role) {
          if (!roles.has(w.accessibility.role)) roles.set(w.accessibility.role, []);
          roles.get(w.accessibility.role)!.push(w.name);
        }
        for (const k of w.accessibility.keyboard) {
          kbPatterns.set(k.key, (kbPatterns.get(k.key) ?? 0) + 1);
        }
      }
    }

    if (roles.size) {
      md.push('### Roles');
      md.push('');
      md.push('| Role | Widgets |');
      md.push('|------|---------|');
      for (const [role, widgetNames] of [...roles.entries()].sort()) {
        md.push(`| ${role} | ${widgetNames.join(', ')} |`);
      }
      md.push('');
    }

    if (kbPatterns.size) {
      md.push('### Keyboard Patterns');
      md.push('');
      md.push('| Key | Used By (count) |');
      md.push('|-----|-----------------|');
      for (const [key, count] of [...kbPatterns.entries()].sort((a, b) => b[1] - a[1])) {
        md.push(`| ${key} | ${count} widget(s) |`);
      }
      md.push('');
    }

    const content = md.join('\n');
    const docId = `ui-library-${Date.now()}`;

    await storage.put('document', docId, {
      docId,
      outputPath,
      themeCount: themes.length,
      widgetCount: totalWidgets,
      groupCount: sortedGroups.length,
      content,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      document: docId,
      files: [outputPath],
    };
  },
};
