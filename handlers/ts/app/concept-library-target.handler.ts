// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ConceptLibraryTarget Concept Implementation
//
// Generates docs/reference/concept-library.md with two views:
//   1. Feature Hierarchy — derived concepts first, composed concepts nested
//   2. Suite Reference — per-suite listing of concepts, syncs, dependencies
//
// Scans the entire project root for .concept, .derived, .sync, and
// suite.yaml files. Groups spec files by nearest suite.yaml ancestor.
// Works with any project directory structure.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import type {
  ConceptAST,
  CompiledSync,
  DerivedAST,
} from '../../../runtime/types.js';
import { parseConceptFile } from '../framework/parser.js';
import { parseDerivedFile } from '../framework/derived-parser.js';
import { parseSyncFile } from '../framework/sync-parser.js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename, relative, dirname } from 'path';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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
// Suite discovery — find all suite.yaml files, build suite-to-dir mapping
// ---------------------------------------------------------------------------

interface SuiteManifestLite {
  name: string;
  dir: string;
  relPath: string;
  version: string;
  description: string;
  concepts: { name: string; optional: boolean }[];
  syncs: { name: string; tier: string }[];
  uses: { suite: string }[];
}

function parseSuiteYaml(source: string, dirName: string): Omit<SuiteManifestLite, 'dir' | 'relPath'> {
  const manifest: Omit<SuiteManifestLite, 'dir' | 'relPath'> = {
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

  const objConceptRe = /^  (\w+):\s*\n\s+spec:/gm;
  let ocm;
  while ((ocm = objConceptRe.exec(source)) !== null) {
    const isOptional = source.slice(ocm.index, ocm.index + 200).includes('optional: true');
    manifest.concepts.push({ name: ocm[1], optional: isOptional });
  }
  if (manifest.concepts.length === 0) {
    const arrConceptRe = /- name:\s*(\w+)/g;
    let acm;
    while ((acm = arrConceptRe.exec(source)) !== null) {
      manifest.concepts.push({ name: acm[1], optional: false });
    }
  }

  const syncPathRe = /path:\s*([^\s]+\.sync)/g;
  let spm;
  while ((spm = syncPathRe.exec(source)) !== null) {
    const before = source.slice(Math.max(0, spm.index - 200), spm.index);
    let tier = 'integration';
    if (before.includes('required:')) tier = 'required';
    else if (before.includes('recommended:')) tier = 'recommended';
    manifest.syncs.push({ name: basename(spm[1], '.sync'), tier });
  }

  const usesRe = /- suite:\s*([\w-]+)/g;
  let um;
  while ((um = usesRe.exec(source)) !== null) {
    manifest.uses.push({ suite: um[1] });
  }

  return manifest;
}

/**
 * Find the nearest suite.yaml ancestor for a file path.
 * Returns the suite manifest, or null if the file isn't under any suite.
 */
function findNearestSuite(
  filePath: string,
  suitesByDir: Map<string, SuiteManifestLite>,
): SuiteManifestLite | null {
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
// Collected data per group (suite or ungrouped directory)
// ---------------------------------------------------------------------------

interface SpecGroup {
  label: string;
  relPath: string;
  manifest: SuiteManifestLite | null;
  concepts: ConceptAST[];
  derived: DerivedAST[];
  syncs: CompiledSync[];
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
// Markdown rendering — individual items
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
  if (d.syncs.recommended?.length) {
    lines.push(`**Recommended syncs**: ${d.syncs.recommended.join(', ')}`);
  }

  if (d.surface.actions.length) {
    lines.push('', '**Surface**:');
    for (const sa of d.surface.actions) {
      let target: string;
      if (sa.matches.type === 'action') target = `${sa.matches.concept}/${sa.matches.action}`;
      else if (sa.matches.type === 'entry') target = `${sa.matches.concept}/${sa.matches.action} (entry)`;
      else target = sa.matches.tag;
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
// Markdown rendering — Feature Hierarchy (derived-first tree)
// ---------------------------------------------------------------------------

function renderFeatureHierarchy(
  allDerived: DerivedAST[],
  conceptsByName: Map<string, ConceptAST>,
  derivedByName: Map<string, DerivedAST>,
  conceptToSuite: Map<string, string>,
): { md: string[]; rendered: Set<string> } {
  const md: string[] = [];
  const rendered = new Set<string>();

  // Build parent map: which derived concepts are children of other derived concepts
  const childDerived = new Set<string>();
  for (const d of allDerived) {
    for (const comp of d.composes) {
      if (comp.isDerived) childDerived.add(d.name);
    }
  }

  // Find root derived concepts (not composed by another derived)
  const composedByDerived = new Set<string>();
  for (const d of allDerived) {
    for (const comp of d.composes) {
      composedByDerived.add(comp.name);
    }
  }
  const rootDerived = allDerived
    .filter(d => !composedByDerived.has(d.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  function renderDerivedTree(d: DerivedAST, depth: number) {
    if (rendered.has(d.name)) return;
    rendered.add(d.name);

    const indent = '#'.repeat(Math.min(depth + 3, 6)); // ### to ######
    const suite = conceptToSuite.get(d.name);
    const suiteTag = suite ? ` <sub>${suite}</sub>` : '';
    md.push(`${indent} ${d.name}${suiteTag}`);
    md.push('');
    if (d.purpose) { md.push(`> ${d.purpose}`); md.push(''); }

    const composeNames = d.composes.map(c => c.name + (c.isDerived ? ' _(derived)_' : ''));
    md.push(`**Composes**: ${composeNames.join(', ')}`);
    if (d.syncs.required.length) md.push(`**Required syncs**: ${d.syncs.required.join(', ')}`);
    if (d.syncs.recommended?.length) md.push(`**Recommended syncs**: ${d.syncs.recommended.join(', ')}`);

    if (d.surface.actions.length) {
      md.push('', '**Surface**:');
      for (const sa of d.surface.actions) {
        let target: string;
        if (sa.matches.type === 'action') target = `${sa.matches.concept}/${sa.matches.action}`;
        else if (sa.matches.type === 'entry') target = `${sa.matches.concept}/${sa.matches.action} (entry)`;
        else target = sa.matches.tag;
        md.push(`- \`${sa.name}\` &rarr; ${target}`);
      }
    }
    md.push('');

    // Render composed base concepts inline (collapsed summary)
    for (const comp of d.composes) {
      if (comp.isDerived) continue; // handled below
      const concept = conceptsByName.get(comp.name);
      if (concept && !rendered.has(comp.name)) {
        rendered.add(comp.name);
        const cIndent = '#'.repeat(Math.min(depth + 4, 6));
        md.push(renderConceptMd(concept, cIndent));
        md.push('');
      }
    }

    // Recurse into composed derived concepts
    for (const comp of d.composes) {
      if (comp.isDerived) {
        const child = derivedByName.get(comp.name);
        if (child) renderDerivedTree(child, depth + 1);
      }
    }
  }

  for (const d of rootDerived) {
    renderDerivedTree(d, 0);
  }

  // Derived concepts that are composed by others but not yet rendered
  // (middle-tier derived that are also roots in some sense)
  for (const d of allDerived.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!rendered.has(d.name)) {
      renderDerivedTree(d, 0);
    }
  }

  return { md, rendered };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const _conceptLibraryTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    if (!input.config || (typeof input.config === 'string' && (input.config as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }
    const config = JSON.parse((input.config as string) || '{}');
    const outputPath = (config.outputPath as string) || 'docs/reference/concept-library.md';
    const projectRoot = (config.projectRoot as string) || process.cwd();

    // ---- Discover all suite.yaml files ----
    const suiteYamlFiles = globRecursive(projectRoot, 'suite.yaml');
    const suitesByDir = new Map<string, SuiteManifestLite>();
    for (const f of suiteYamlFiles) {
      try {
        const dir = dirname(f);
        const relPath = relative(projectRoot, dir).replace(/\\/g, '/');
        const parsed = parseSuiteYaml(readFileSync(f, 'utf-8'), basename(dir));
        suitesByDir.set(dir, { ...parsed, dir, relPath });
      } catch { /* skip */ }
    }

    // ---- Discover all spec files ----
    const conceptFiles = globRecursive(projectRoot, '.concept');
    const derivedFiles = globRecursive(projectRoot, '.derived');
    const syncFiles = globRecursive(projectRoot, '.sync');

    // ---- Group files by nearest suite (or by parent directory) ----
    const groups = new Map<string, SpecGroup>();

    function getGroup(filePath: string): SpecGroup {
      const suite = findNearestSuite(filePath, suitesByDir);
      if (suite) {
        if (!groups.has(suite.dir)) {
          groups.set(suite.dir, {
            label: suite.name,
            relPath: suite.relPath,
            manifest: suite,
            concepts: [],
            derived: [],
            syncs: [],
          });
        }
        return groups.get(suite.dir)!;
      }
      // No suite.yaml ancestor — group by immediate parent dir relative to root
      const relDir = relative(projectRoot, dirname(filePath)).replace(/\\/g, '/');
      const topDir = relDir.split('/')[0] || 'root';
      const key = `__ungrouped__${topDir}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: topDir,
          relPath: relDir,
          manifest: null,
          concepts: [],
          derived: [],
          syncs: [],
        });
      }
      return groups.get(key)!;
    }

    for (const f of conceptFiles) {
      try {
        getGroup(f).concepts.push(parseConceptFile(readFileSync(f, 'utf-8')));
      } catch { /* skip */ }
    }
    for (const f of derivedFiles) {
      try {
        getGroup(f).derived.push(parseDerivedFile(readFileSync(f, 'utf-8')));
      } catch { /* skip */ }
    }
    for (const f of syncFiles) {
      try {
        getGroup(f).syncs.push(...parseSyncFile(readFileSync(f, 'utf-8')));
      } catch { /* skip */ }
    }

    const sortedGroups = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));

    // ---- Build global indexes ----
    const allConcepts: ConceptAST[] = [];
    const allDerived: DerivedAST[] = [];
    const allSyncs: CompiledSync[] = [];
    const conceptsByName = new Map<string, ConceptAST>();
    const derivedByName = new Map<string, DerivedAST>();
    const conceptToSuite = new Map<string, string>();

    for (const g of sortedGroups) {
      for (const c of g.concepts) {
        allConcepts.push(c);
        conceptsByName.set(c.name, c);
        conceptToSuite.set(c.name, g.label);
      }
      for (const d of g.derived) {
        allDerived.push(d);
        derivedByName.set(d.name, d);
        conceptToSuite.set(d.name, g.label);
      }
      for (const s of g.syncs) allSyncs.push(s);
    }

    // ---- Render markdown ----
    const md: string[] = [];
    md.push('# Concept Library Reference');
    md.push('');
    md.push(`> Auto-generated by ConceptLibraryTarget — ${allConcepts.length} concepts, ${allDerived.length} derived, ${allSyncs.length} syncs across ${sortedGroups.length} groups`);
    md.push('');

    // Table of contents
    md.push('## Table of Contents');
    md.push('');
    md.push('- [Feature Hierarchy](#feature-hierarchy) — derived concepts with composed bases');
    md.push('- [Standalone Concepts](#standalone-concepts) — base concepts not part of any derivation');
    md.push('- [Suite Reference](#suite-reference) — per-suite listing');
    md.push('- [Cross-Reference Index](#cross-reference-index)');
    md.push('');

    // ================================================================
    // Part 1: Feature Hierarchy
    // ================================================================
    md.push('---');
    md.push('');
    md.push('## Feature Hierarchy');
    md.push('');
    md.push('Derived concepts shown as top-level features with their composed concepts nested underneath.');
    md.push('');

    const { md: hierarchyMd, rendered: renderedInHierarchy } =
      renderFeatureHierarchy(allDerived, conceptsByName, derivedByName, conceptToSuite);
    md.push(...hierarchyMd);

    // ================================================================
    // Part 1b: Standalone Concepts (not claimed by any derived)
    // ================================================================
    const standaloneConcepts = allConcepts
      .filter(c => !renderedInHierarchy.has(c.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (standaloneConcepts.length) {
      md.push('---');
      md.push('');
      md.push('## Standalone Concepts');
      md.push('');
      md.push(`${standaloneConcepts.length} base concepts not composed by any derived concept.`);
      md.push('');

      for (const c of standaloneConcepts) {
        const suite = conceptToSuite.get(c.name);
        const suiteTag = suite ? ` <sub>${suite}</sub>` : '';
        // Render with suite tag appended to heading
        const lines = renderConceptMd(c, '###').split('\n');
        lines[0] = lines[0] + suiteTag;
        md.push(lines.join('\n'));
        md.push('');
      }
    }

    // ================================================================
    // Part 2: Suite Reference
    // ================================================================
    md.push('---');
    md.push('');
    md.push('## Suite Reference');
    md.push('');

    for (const g of sortedGroups) {
      const isSuite = g.manifest !== null;
      const heading = isSuite ? g.label : `${g.label} _(ungrouped)_`;
      md.push(`### ${heading}`);
      if (isSuite && g.manifest!.version) md.push(`_v${g.manifest!.version}_ — \`${g.relPath}\``);
      else md.push(`\`${g.relPath}\``);
      md.push('');
      if (g.manifest?.description) {
        md.push(`> ${g.manifest.description}`);
        md.push('');
      }

      // Compact concept list
      if (g.concepts.length) {
        md.push(`**Concepts** (${g.concepts.length}): ${g.concepts.map(c => c.name).sort().join(', ')}`);
        md.push('');
      }
      if (g.derived.length) {
        md.push(`**Derived** (${g.derived.length}): ${g.derived.map(d => d.name).sort().join(', ')}`);
        md.push('');
      }

      // Syncs
      if (g.syncs.length) {
        md.push(`**Syncs** (${g.syncs.length}):`);
        for (const sync of g.syncs.slice(0, 20)) {
          md.push(renderSyncMd(sync));
        }
        if (g.syncs.length > 20) md.push(`- _(${g.syncs.length - 20} more syncs)_`);
        md.push('');
      }

      // Dependencies
      if (g.manifest?.uses.length) {
        md.push(`**Uses**: ${g.manifest.uses.map(u => u.suite).join(', ')}`);
        md.push('');
      }
    }

    // ================================================================
    // Part 3: Cross-Reference Index
    // ================================================================
    md.push('---');
    md.push('');
    md.push('## Cross-Reference Index');
    md.push('');
    md.push('| Name | Suite | Type | Composed By |');
    md.push('|------|-------|------|-------------|');

    const allEntries: { name: string; suite: string; type: string; composedBy: string }[] = [];

    // Build reverse index: concept name -> which derived concepts compose it
    const composedByIndex = new Map<string, string[]>();
    for (const d of allDerived) {
      for (const comp of d.composes) {
        if (!composedByIndex.has(comp.name)) composedByIndex.set(comp.name, []);
        composedByIndex.get(comp.name)!.push(d.name);
      }
    }

    for (const c of allConcepts) {
      allEntries.push({
        name: c.name,
        suite: conceptToSuite.get(c.name) || '—',
        type: 'concept',
        composedBy: composedByIndex.get(c.name)?.join(', ') || '—',
      });
    }
    for (const d of allDerived) {
      allEntries.push({
        name: d.name,
        suite: conceptToSuite.get(d.name) || '—',
        type: 'derived',
        composedBy: composedByIndex.get(d.name)?.join(', ') || '—',
      });
    }

    allEntries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of allEntries) {
      md.push(`| ${e.name} | ${e.suite} | ${e.type} | ${e.composedBy} |`);
    }
    md.push('');

    const content = md.join('\n');
    const docId = `concept-library-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'document', docId, {
      docId,
      outputPath,
      groupCount: sortedGroups.length,
      conceptCount: allConcepts.length,
      derivedCount: allDerived.length,
      syncCount: allSyncs.length,
      content,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      document: docId,
      files: [outputPath],
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const conceptLibraryTargetHandler = autoInterpret(_conceptLibraryTargetHandler);

