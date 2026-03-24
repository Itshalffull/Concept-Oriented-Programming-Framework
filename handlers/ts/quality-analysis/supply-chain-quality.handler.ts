// @clef-handler style=functional
// ============================================================
// SupplyChainQuality Handler
//
// Assess the quality, security, and trustworthiness of software
// dependencies. Track OpenSSF Scorecard results, SBOM completeness,
// vulnerability density, and behavioral analysis flags. Operates
// on package metadata and provenance, not source code.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `scq-${++idCounter}`;
}

const VALID_ECOSYSTEMS = ['npm', 'pypi', 'cargo', 'maven', 'go'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

function computeRiskLevel(
  openssfScore: number | null,
  vulnCount: number,
  criticalVulns: number,
  behavioralFlags: string[],
): string {
  if (criticalVulns > 0 || behavioralFlags.length >= 3) return 'critical';
  if (vulnCount > 5 || (openssfScore !== null && openssfScore < 3)) return 'high';
  if (vulnCount > 0 || behavioralFlags.length > 0 || (openssfScore !== null && openssfScore < 5)) return 'medium';
  return 'low';
}

const _supplyChainQualityHandler: FunctionalConceptHandler = {

  // ── scan ──────────────────────────────────────────────────
  scan(input: Record<string, unknown>) {
    const ecosystem = input.ecosystem as string;
    const targets = input.targets as string[] | null | undefined;

    if (!ecosystem || !VALID_ECOSYSTEMS.includes(ecosystem)) {
      return complete(createProgram(), 'error', {
        message: `ecosystem must be one of: ${VALID_ECOSYSTEMS.join(', ')}; got "${ecosystem}"`,
      });
    }

    // In a real deployment, providers would perform actual scanning.
    // Stub: create assessments for each target or return empty scan.
    let p = createProgram();

    if (targets && targets.length > 0) {
      // Scan specific targets — create stub assessments
      const assessments = targets.map(pkg => {
        const id = nextId();
        const assessment = {
          id,
          packageName: pkg,
          packageVersion: 'latest',
          ecosystem,
          directDependency: true,
          assessedAt: new Date().toISOString(),
          openssfScore: 7.5,
          scorecardChecks: [],
          knownVulnerabilities: [],
          vulnerabilityDensity: 0,
          sbomPresent: false,
          sbomCompleteness: null,
          sbomStandard: null,
          provenanceVerified: false,
          installScriptRisk: null,
          networkAccess: false,
          credentialAccess: false,
          behavioralFlags: [],
        };
        return { id, assessment };
      });

      // Store all assessments
      for (const { id, assessment } of assessments) {
        p = put(p, 'assessment', id, assessment);
      }

      const results = assessments.map(({ assessment }) => ({
        packageName: assessment.packageName,
        packageVersion: assessment.packageVersion,
        openssfScore: assessment.openssfScore,
        vulnerabilityCount: assessment.knownVulnerabilities.length,
        criticalVulnerabilities: 0,
        behavioralFlags: assessment.behavioralFlags,
        riskLevel: computeRiskLevel(
          assessment.openssfScore,
          assessment.knownVulnerabilities.length,
          0,
          assessment.behavioralFlags,
        ),
      }));

      return complete(p, 'ok', { assessments: results });
    }

    // No specific targets — scan all (stub: return empty list)
    return complete(p, 'ok', { assessments: [] });
  },

  // ── assess ────────────────────────────────────────────────
  assess(input: Record<string, unknown>) {
    const packageName = input.packageName as string;
    const packageVersion = input.packageVersion as string;
    const ecosystem = input.ecosystem as string;

    if (!packageName || packageName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'packageName is required' });
    }

    // Stub: simulate package not found for obviously fake packages
    if (packageName.startsWith('nonexistent-')) {
      return complete(createProgram(), 'notFound', { packageName, ecosystem });
    }

    let p = createProgram();

    // Check if already assessed
    p = find(p, 'assessment', { packageName, packageVersion, ecosystem }, 'existing');

    return branch(p,
      (bindings) => {
        const arr = bindings.existing as unknown[];
        return arr && arr.length > 0;
      },
      // Already assessed — return existing
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.existing as Record<string, unknown>[];
          return arr[0];
        }, '_existingAssessment');
        return completeFrom(b, 'ok', (bindings) => ({
          assessment: (bindings._existingAssessment as Record<string, unknown>).id as string,
        }));
      })(),
      // New assessment
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'assessment', id, {
          id,
          packageName,
          packageVersion,
          ecosystem,
          directDependency: true,
          assessedAt: new Date().toISOString(),
          openssfScore: 6.0,
          scorecardChecks: [
            { check: 'Code-Review', score: 7.0, reason: 'Most changes reviewed' },
            { check: 'Maintained', score: 8.0, reason: 'Active maintenance' },
            { check: 'Vulnerabilities', score: 5.0, reason: 'Some past vulnerabilities' },
          ],
          knownVulnerabilities: [],
          vulnerabilityDensity: 0,
          sbomPresent: false,
          sbomCompleteness: null,
          sbomStandard: null,
          provenanceVerified: false,
          installScriptRisk: null,
          networkAccess: false,
          credentialAccess: false,
          behavioralFlags: [],
        });
        return complete(b, 'ok', { assessment: id });
      })(),
    );
  },

  // ── risks ─────────────────────────────────────────────────
  risks(input: Record<string, unknown>) {
    const minRiskLevel = (input.minRiskLevel as string) ?? 'medium';

    const minIndex = RISK_LEVELS.indexOf(minRiskLevel);
    const thresholdLevels = minIndex >= 0
      ? RISK_LEVELS.slice(minIndex)
      : RISK_LEVELS.slice(1); // default: medium and above

    let p = createProgram();
    p = find(p, 'assessment', {}, 'allAssessments');

    p = mapBindings(p, (bindings) => {
      const assessments = (bindings.allAssessments as Record<string, unknown>[]) || [];

      return assessments
        .map(a => {
          const openssfScore = a.openssfScore as number | null;
          const vulns = (a.knownVulnerabilities as Array<{ severity: string }>) || [];
          const criticalVulns = vulns.filter(v => v.severity === 'critical').length;
          const flags = (a.behavioralFlags as string[]) || [];
          const riskLevel = computeRiskLevel(openssfScore, vulns.length, criticalVulns, flags);
          const reasons: string[] = [];

          if (criticalVulns > 0) reasons.push(`${criticalVulns} critical vulnerabilities`);
          if (vulns.length > 0) reasons.push(`${vulns.length} known vulnerabilities`);
          if (openssfScore !== null && openssfScore < 5) reasons.push(`Low OpenSSF score: ${openssfScore}`);
          if (flags.length > 0) reasons.push(`Behavioral flags: ${flags.join(', ')}`);

          return {
            packageName: a.packageName as string,
            packageVersion: a.packageVersion as string,
            riskLevel,
            reasons,
            directDependency: a.directDependency as boolean,
          };
        })
        .filter(r => thresholdLevels.includes(r.riskLevel));
    }, '_atRisk');

    return completeFrom(p, 'ok', (bindings) => ({
      atRisk: bindings._atRisk as unknown[],
    }));
  },

  // ── summary ───────────────────────────────────────────────
  summary(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'assessment', {}, 'allAssessments');

    p = mapBindings(p, (bindings) => {
      const assessments = (bindings.allAssessments as Record<string, unknown>[]) || [];
      const total = assessments.length;
      const direct = assessments.filter(a => a.directDependency === true).length;
      const transitive = total - direct;

      const scores = assessments
        .map(a => a.openssfScore as number | null)
        .filter((s): s is number => s !== null);
      const meanOpenssfScore = scores.length > 0
        ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100
        : null;

      let totalVulns = 0;
      let criticalVulns = 0;
      let flagCount = 0;
      let sbomPresentCount = 0;

      for (const a of assessments) {
        const vulns = (a.knownVulnerabilities as Array<{ severity: string }>) || [];
        totalVulns += vulns.length;
        criticalVulns += vulns.filter(v => v.severity === 'critical').length;
        flagCount += ((a.behavioralFlags as string[]) || []).length;
        if (a.sbomPresent === true) sbomPresentCount++;
      }

      const sbomCompleteness = total > 0
        ? Math.round((sbomPresentCount / total) * 100) / 100
        : null;

      return {
        totalDependencies: total,
        directDependencies: direct,
        transitiveDependencies: transitive,
        meanOpenssfScore,
        totalVulnerabilities: totalVulns,
        criticalVulnerabilities: criticalVulns,
        behavioralFlags: flagCount,
        sbomCompleteness,
      };
    }, '_overview');

    return completeFrom(p, 'ok', (bindings) => ({
      overview: bindings._overview as Record<string, unknown>,
    }));
  },

  // ── verify ────────────────────────────────────────────────
  verify(input: Record<string, unknown>) {
    const packageName = input.packageName as string;
    const packageVersion = input.packageVersion as string;

    let p = createProgram();
    p = find(p, 'assessment', { packageName, packageVersion }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // unknown
      complete(createProgram(), 'unknown', { packageName }),
      // found — check trust
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_assessment');

        b = mapBindings(b, (bindings) => {
          const a = bindings._assessment as Record<string, unknown>;
          const openssfScore = a.openssfScore as number | null;
          const vulns = (a.knownVulnerabilities as Array<{ severity: string }>) || [];
          const criticalVulns = vulns.filter(v => v.severity === 'critical').length;
          const flags = (a.behavioralFlags as string[]) || [];
          const reasons: string[] = [];

          if (criticalVulns > 0) reasons.push(`${criticalVulns} critical vulnerabilities`);
          if (vulns.length > 0) reasons.push(`${vulns.length} known vulnerabilities`);
          if (openssfScore !== null && openssfScore < 5) reasons.push(`Low OpenSSF score: ${openssfScore}`);
          if (flags.length > 0) reasons.push(`Behavioral flags: ${flags.join(', ')}`);
          if (a.credentialAccess === true) reasons.push('Credential access detected');
          if (a.installScriptRisk && a.installScriptRisk !== 'none') reasons.push(`Install script risk: ${a.installScriptRisk}`);

          return {
            id: a.id as string,
            trusted: reasons.length === 0,
            reasons,
          };
        }, '_trustResult');

        return branch(b,
          (bindings) => {
            const result = bindings._trustResult as { trusted: boolean };
            return result.trusted;
          },
          // trusted
          (() => {
            let c = createProgram();
            return completeFrom(c, 'trusted', (bindings) => ({
              assessment: (bindings._trustResult as { id: string }).id,
            }));
          })(),
          // untrusted
          (() => {
            let c = createProgram();
            return completeFrom(c, 'untrusted', (bindings) => {
              const result = bindings._trustResult as { id: string; reasons: string[] };
              return {
                assessment: result.id,
                reasons: result.reasons,
              };
            });
          })(),
        );
      })(),
    );
  },
};

export const supplyChainQualityHandler = autoInterpret(_supplyChainQualityHandler);

export function resetSupplyChainQualityCounter(): void {
  idCounter = 0;
}
