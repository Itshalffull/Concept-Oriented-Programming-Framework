// ConceptLibraryTarget Concept Implementation
//
// Generates docs/reference/concept-library.md from typed IRs:
// ConceptAST, CompiledSync, DerivedAST, and SuiteManifest.
// Organizes concepts hierarchically by suite with derived concepts
// nested under their composed bases.
import type { ConceptHandler } from '@clef/runtime';
import type {
  ConceptAST,
  CompiledSync,
  DerivedAST,
} from '../../../runtime/types.js';
import { parseConceptFile } from '../framework/parser.js';
import { parseDerivedFile } from '../framework/derived-parser.js';
import { parseSyncFile } from '../framework/sync-parser.js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

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
// Suite manifest (YAML) — lightweight extraction (no full YAML parser needed)
// ---------------------------------------------------------------------------

interface SuiteManifestLite {
  name: string;
  version: string;
  description: string;
  concepts: { name: string; optional: boolean }[];
  syncs: { name: string; tier: string }[];
  uses: { suite: string }[];
}

function parseSuiteYaml(source: string, dirName: string): SuiteManifestLite {
  const manifest: SuiteManifestLite = {
    name: dirName,
    version: '0.1.0',
    description: '',
    concepts: [],
    syncs: [],
    uses: [],
  };

  const nameMatch = source.match(/name:\s*(.+)/);
  if (nameMatch) manifest.name = nameMatch[1].trim();

  const versionMatch = source.match(/version:\s*(.+)/);
  if (versionMatch) manifest.version = versionMatch[1].trim();

  const descMatch = source.match(/description:\s*>?\s*\n((?:\s{4,}.+\n?)*)/);
  if (descMatch) {
    manifest.description = descMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    const descInline = source.match(/description:\s*(.+)/);
    if (descInline) manifest.description = descInline[1].trim();
  }

  // Concepts — object style: ConceptName:\n    spec:
  const objConceptRe = /^  (\w+):\s*\n\s+spec:/gm;
  let ocm;
  while ((ocm = objConceptRe.exec(source)) !== null) {
    const isOptional = source.slice(ocm.index, ocm.index + 200).includes('optional: true');
    manifest.concepts.push({ name: ocm[1], optional: isOptional });
  }
  // Array style: - name: ConceptName
  if (manifest.concepts.length === 0) {
    const arrConceptRe = /- name:\s*(\w+)/g;
    let acm;
    while ((acm = arrConceptRe.exec(source)) !== null) {
      manifest.concepts.push({ name: acm[1], optional: false });
    }
  }

  // Syncs
  const syncPathRe = /path:\s*([^\s]+\.sync)/g;
  let spm;
  while ((spm = syncPathRe.exec(source)) !== null) {
    const before = source.slice(Math.max(0, spm.index - 200), spm.index);
    let tier = 'integration';
    if (before.includes('required:')) tier = 'required';
    else if (before.includes('recommended:')) tier = 'recommended';
    manifest.syncs.push({ name: basename(spm[1], '.sync'), tier });
  }

  // Uses
  const usesRe = /- suite:\s*([\w-]+)/g;
  let um;
  while ((um = usesRe.exec(source)) !== null) {
    manifest.uses.push({ suite: um[1] });
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Type expression rendering
// ---------------------------------------------------------------------------

function renderTypeExpr(t: ConceptAST['state'][0]['type']): string {
  switch (t.kind) {
    case 'primitive': return t.name;
    case 'param': return t.name;
    case 'set': return `Set<${renderTypeExpr(t.inner)}>`;
    case 'list': return `List<${renderTypeExpr(t.inner)}>`;
    case 'option': return `${renderTypeExpr(t.inner)}?`;
    case 'relation': return `${renderTypeExpr(t.from)} → ${renderTypeExpr(t.to)}`;
    case 'record': return `{ ${t.fields.map(f => `${f.name}: ${renderTypeExpr(f.type)}`).join(', ')} }`;
    case 'enum': return `{${t.values.join(' | ')}}`;
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderConceptMd(c: ConceptAST, indent: string): string {
  const lines: string[] = [];
  const tpStr = c.typeParams.join(', ');
  const tags: string[] = [];
  if (c.annotations?.gate) tags.push('`@gate`');
  if (c.annotations?.category) tags.push(`\`@category(${c.annotations.category})\``);
  const tagStr = tags.length ? ' ' + tags.join(' ') : '';

  lines.push(`${indent} ${c.name} [${tpStr}]${tagStr}`);
  if (c.purpose) lines.push('', `> ${c.purpose}`);
  if (c.capabilities.length) lines.push('', `**Capabilities**: ${c.capabilities.join(', ')}`);

  if (c.state.length) {
    lines.push('', '**State**:');
    for (const s of c.state.slice(0, 15)) {
      lines.push(`- \`${s.name}: ${renderTypeExpr(s.type)}\``);
    }
    if (c.state.length > 15) lines.push(`- _(${c.state.length - 15} more fields)_`);
  }

  if (c.actions.length) {
    lines.push('', '**Actions**:');
    for (const a of c.actions) {
      const params = a.params.map((p) => `${p.name}: ${renderTypeExpr(p.type)}`).join(', ');
      const variants = a.variants.length ? a.variants.map((v) => v.name).join(' | ') : 'ok';
      lines.push(`- \`${a.name}(${params})\` &rarr; ${variants}`);
    }
  }
  return lines.join('\n');
}

function renderDerivedMd(d: DerivedAST, indent: string): string {
  const lines: string[] = [];
  const tpStr = d.typeParams.join(', ');
  lines.push(`${indent} ${d.name} [${tpStr}] _(derived)_`);
  if (d.purpose) lines.push('', `> ${d.purpose}`);

  const composeNames = d.composes.map((c) => c.name + (c.isDerived ? ' _(derived)_' : ''));
  lines.push('', `**Composes**: ${composeNames.join(', ')}`);

  if (d.syncs.required.length) {
    lines.push(`**Required syncs**: ${d.syncs.required.join(', ')}`);
  }

  if (d.surface.actions.length) {
    lines.push('', '**Surface**:');
    for (const sa of d.surface.actions) {
      const target =
        sa.matches.type === 'action'
          ? `${sa.matches.concept}/${sa.matches.action}`
          : sa.matches.tag;
      lines.push(`- \`${sa.name}\` &rarr; ${target}`);
    }
  }
  return lines.join('\n');
}

function renderSyncMd(s: CompiledSync): string {
  const mode = s.annotations?.includes('eager') ? 'eager' : 'lazy';
  const lines: string[] = [];
  lines.push(`- **${s.name}** _(${mode})_`);
  for (const w of s.when) {
    lines.push(`  - When: ${w.concept}/${w.action}`);
  }
  for (const t of s.then) {
    lines.push(`  - Then: ${t.concept}/${t.action}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const conceptLibraryTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const config = JSON.parse((input.config as string) || '{}');
    const outputPath = (config.outputPath as string) || 'docs/reference/concept-library.md';
    const repertoireDir =
      (config.repertoireDir as string) || join(process.cwd(), 'repertoire', 'concepts');

    const suiteDirs = readdirSync(repertoireDir).filter((d) => {
      try {
        return statSync(join(repertoireDir, d)).isDirectory();
      } catch {
        return false;
      }
    });

    // ---- Collect data per suite using real parsers ----
    const suites: {
      manifest: SuiteManifestLite;
      concepts: ConceptAST[];
      derived: DerivedAST[];
      syncs: CompiledSync[];
    }[] = [];

    for (const dir of suiteDirs.sort()) {
      const suiteDir = join(repertoireDir, dir);
      const suiteYamlPath = join(suiteDir, 'suite.yaml');
      const manifest = existsSync(suiteYamlPath)
        ? parseSuiteYaml(readFileSync(suiteYamlPath, 'utf-8'), dir)
        : {
            name: dir,
            version: '0.1.0',
            description: '',
            concepts: [],
            syncs: [],
            uses: [],
          };

      const conceptFiles = globRecursive(suiteDir, '.concept');
      const concepts: ConceptAST[] = [];
      for (const f of conceptFiles) {
        try {
          concepts.push(parseConceptFile(readFileSync(f, 'utf-8')));
        } catch {
          // Skip files that fail to parse (e.g. malformed specs)
        }
      }

      const derivedFiles = globRecursive(suiteDir, '.derived');
      const derived: DerivedAST[] = [];
      for (const f of derivedFiles) {
        try {
          derived.push(parseDerivedFile(readFileSync(f, 'utf-8')));
        } catch {
          // Skip files that fail to parse
        }
      }

      const syncFiles = globRecursive(suiteDir, '.sync');
      const syncs: CompiledSync[] = [];
      for (const f of syncFiles) {
        try {
          syncs.push(...parseSyncFile(readFileSync(f, 'utf-8')));
        } catch {
          // Skip files that fail to parse
        }
      }

      suites.push({ manifest, concepts, derived, syncs });
    }

    // ---- Build derived concept hierarchy ----
    // Map: concept name -> which derived concepts compose it
    const composedBy = new Map<string, DerivedAST[]>();
    for (const s of suites) {
      for (const d of s.derived) {
        for (const c of d.composes) {
          if (!composedBy.has(c.name)) composedBy.set(c.name, []);
          composedBy.get(c.name)!.push(d);
        }
      }
    }

    // ---- Render markdown ----
    const md: string[] = [];
    md.push('# Concept Library Reference');
    md.push('');
    md.push('> Auto-generated from `repertoire/` by ConceptLibraryTarget');
    md.push('');

    // Table of contents
    md.push('## Table of Contents');
    md.push('');
    for (const s of suites) {
      const slug = s.manifest.name.replace(/\s+/g, '-').toLowerCase();
      md.push(
        `- [${s.manifest.name}](#${slug}) — ${s.concepts.length} concepts, ${s.derived.length} derived, ${s.syncs.length} syncs`,
      );
    }
    md.push('');

    // Suite sections
    for (const s of suites) {
      md.push('---');
      md.push('');
      md.push(`## ${s.manifest.name}`);
      if (s.manifest.version) md.push(`_v${s.manifest.version}_`);
      md.push('');
      if (s.manifest.description) {
        md.push(`> ${s.manifest.description}`);
        md.push('');
      }

      // Concepts with nested derived hierarchy
      if (s.concepts.length) {
        md.push('### Concepts');
        md.push('');

        // Track which derived concepts we render inline
        const renderedDerived = new Set<string>();

        for (const c of s.concepts.sort((a, b) => a.name.localeCompare(b.name))) {
          md.push(renderConceptMd(c, '####'));
          md.push('');

          // Nest derived concepts that list this concept as their first compose
          const children = s.derived.filter((d) => d.composes[0]?.name === c.name);
          for (const child of children) {
            md.push(renderDerivedMd(child, '#####'));
            md.push('');
            renderedDerived.add(child.name);

            // Second-level: derived-of-derived
            const grandchildren = s.derived.filter(
              (d2) => d2.composes.some((comp) => comp.name === child.name && comp.isDerived),
            );
            for (const gc of grandchildren) {
              md.push(renderDerivedMd(gc, '######'));
              md.push('');
              renderedDerived.add(gc.name);
            }
          }
        }

        // Standalone derived (compose cross-suite bases or other derived)
        const standalone = s.derived.filter((d) => !renderedDerived.has(d.name));
        if (standalone.length) {
          md.push('### Derived Concepts');
          md.push('');
          for (const d of standalone.sort((a, b) => a.name.localeCompare(b.name))) {
            md.push(renderDerivedMd(d, '####'));
            md.push('');
          }
        }
      }

      // Syncs
      if (s.syncs.length) {
        md.push('### Syncs');
        md.push('');
        for (const sync of s.syncs) {
          md.push(renderSyncMd(sync));
        }
        md.push('');
      }

      // Dependencies
      if (s.manifest.uses.length) {
        md.push('### Dependencies');
        md.push('');
        for (const u of s.manifest.uses) {
          md.push(`- **${u.suite}**`);
        }
        md.push('');
      }
    }

    // Cross-suite index
    md.push('---');
    md.push('');
    md.push('## Cross-Suite Concept Index');
    md.push('');
    md.push('| Concept | Suite | Type |');
    md.push('|---------|-------|------|');
    const allEntries: { name: string; suite: string; type: string }[] = [];
    for (const s of suites) {
      for (const c of s.concepts)
        allEntries.push({ name: c.name, suite: s.manifest.name, type: 'base' });
      for (const d of s.derived)
        allEntries.push({ name: d.name, suite: s.manifest.name, type: 'derived' });
    }
    allEntries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of allEntries) {
      md.push(`| ${e.name} | ${e.suite} | ${e.type} |`);
    }
    md.push('');

    const content = md.join('\n');
    const docId = `concept-library-${Date.now()}`;

    await storage.put('document', docId, {
      docId,
      outputPath,
      suiteCount: suites.length,
      conceptCount: allEntries.filter((e) => e.type === 'base').length,
      derivedCount: allEntries.filter((e) => e.type === 'derived').length,
      syncCount: suites.reduce((n, s) => n + s.syncs.length, 0),
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
