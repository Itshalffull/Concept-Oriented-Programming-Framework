// UILibraryTarget Concept Implementation
//
// Generates docs/reference/ui-library.md from typed manifests:
// WidgetManifest and ThemeManifest. Organizes widgets by suite
// with theme inheritance shown.
import type { ConceptHandler } from '@clef/runtime';
import type { WidgetManifest, ThemeManifest } from '../../../runtime/types.js';
import { parseWidgetFile } from '../framework/widget-spec-parser.js';
import { parseThemeFile } from '../framework/theme-spec-parser.js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function globRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
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
// Handler
// ---------------------------------------------------------------------------

export const uiLibraryTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const config = JSON.parse((input.config as string) || '{}');
    const outputPath = (config.outputPath as string) || 'docs/reference/ui-library.md';
    const repertoireDir =
      (config.repertoireDir as string) || join(process.cwd(), 'repertoire');

    // ---- Collect themes as ThemeManifest ----
    const themesDir = join(repertoireDir, 'themes');
    const themeFiles = existsSync(themesDir) ? globRecursive(themesDir, '.theme') : [];
    const themes: ThemeManifest[] = [];
    for (const f of themeFiles) {
      try {
        themes.push(parseThemeFile(readFileSync(f, 'utf-8')));
      } catch {
        // Skip files that fail to parse
      }
    }

    // ---- Collect widgets as WidgetManifest, grouped by suite ----
    const conceptsDir = join(repertoireDir, 'concepts');
    const suiteDirs = existsSync(conceptsDir)
      ? readdirSync(conceptsDir).filter((d) => {
          try {
            return statSync(join(conceptsDir, d)).isDirectory();
          } catch {
            return false;
          }
        })
      : [];

    const widgetsBySuite = new Map<string, WidgetManifest[]>();
    for (const dir of suiteDirs.sort()) {
      const widgetFiles = globRecursive(join(conceptsDir, dir), '.widget');
      if (widgetFiles.length === 0) continue;
      const widgets: WidgetManifest[] = [];
      for (const f of widgetFiles) {
        try {
          widgets.push(parseWidgetFile(readFileSync(f, 'utf-8')));
        } catch {
          // Skip files that fail to parse
        }
      }
      if (widgets.length) widgetsBySuite.set(dir, widgets);
    }

    // ---- Render markdown ----
    const md: string[] = [];
    md.push('# UI Library Reference');
    md.push('');
    md.push('> Auto-generated from `repertoire/` by UILibraryTarget');
    md.push('');

    // Table of contents
    md.push('## Table of Contents');
    md.push('');
    if (themes.length) md.push('- [Themes](#themes)');
    for (const [suite, widgets] of widgetsBySuite) {
      const slug = suite.replace(/\s+/g, '-').toLowerCase();
      md.push(`- [${suite}](#${slug}) — ${widgets.length} widgets`);
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

    // Widgets by suite
    md.push('## Widgets by Suite');
    md.push('');

    for (const [suite, widgets] of widgetsBySuite) {
      md.push(`### ${suite}`);
      md.push('');

      for (const w of widgets.sort((a, b) => a.name.localeCompare(b.name))) {
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
    md.push('| Widget | Suite | Serves | Specificity | Binds To |');
    md.push('|--------|-------|--------|-------------|----------|');
    for (const [suite, widgets] of widgetsBySuite) {
      for (const w of widgets.sort((a, b) => a.name.localeCompare(b.name))) {
        if (w.affordance) {
          const bindsTo =
            w.affordance.when ||
            w.affordance.binds.map((b) => b.field).join(', ') ||
            '—';
          md.push(
            `| ${w.name} | ${suite} | ${w.affordance.serves} | ${w.affordance.specificity ?? '—'} | ${bindsTo} |`,
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
    for (const [, widgets] of widgetsBySuite) {
      for (const w of widgets) {
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
    const totalWidgets = [...widgetsBySuite.values()].reduce((n, ws) => n + ws.length, 0);

    await storage.put('document', docId, {
      docId,
      outputPath,
      themeCount: themes.length,
      widgetCount: totalWidgets,
      suiteCount: widgetsBySuite.size,
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
