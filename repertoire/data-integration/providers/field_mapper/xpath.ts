// XPath field mapper — XPath expression evaluation for XML-like structures
// Supports: / (root), // (descendant), [@attr] (attribute predicate), text() (text content)
// Operates on a JS object representation of XML: { tag, attributes, children, text }

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'xpath';
export const PLUGIN_TYPE = 'field_mapper';

interface XmlNode {
  tag: string;
  attributes?: Record<string, string>;
  children?: XmlNode[];
  text?: string;
}

function isXmlNode(v: unknown): v is XmlNode {
  return v !== null && typeof v === 'object' && 'tag' in (v as Record<string, unknown>);
}

function parseStep(step: string): { axis: string; tag: string; predicate?: string } {
  const predicateMatch = step.match(/^(.+?)\[(.+)\]$/);
  let tag = step;
  let predicate: string | undefined;
  if (predicateMatch) {
    tag = predicateMatch[1];
    predicate = predicateMatch[2];
  }
  return { axis: 'child', tag, predicate };
}

function matchesPredicate(node: XmlNode, predicate: string): boolean {
  // Attribute existence: [@attr]
  const attrExist = predicate.match(/^@(\w+)$/);
  if (attrExist) {
    return node.attributes !== undefined && attrExist[1] in node.attributes;
  }
  // Attribute value: [@attr='value']
  const attrVal = predicate.match(/^@(\w+)\s*=\s*['"]([^'"]*)['"]/);
  if (attrVal) {
    return node.attributes?.[attrVal[1]] === attrVal[2];
  }
  // Positional: [n]
  const posMatch = predicate.match(/^(\d+)$/);
  if (posMatch) {
    return true; // positional filtering handled at collection level
  }
  return true;
}

function getPositionalIndex(predicate: string): number | null {
  const posMatch = predicate.match(/^(\d+)$/);
  return posMatch ? parseInt(posMatch[1], 10) : null;
}

function findDescendants(node: XmlNode, tag: string): XmlNode[] {
  const results: XmlNode[] = [];
  if (node.children) {
    for (const child of node.children) {
      if (child.tag === tag || tag === '*') {
        results.push(child);
      }
      results.push(...findDescendants(child, tag));
    }
  }
  return results;
}

function findChildren(node: XmlNode, tag: string): XmlNode[] {
  if (!node.children) return [];
  if (tag === '*') return [...node.children];
  return node.children.filter(c => c.tag === tag);
}

function extractTextContent(node: XmlNode): string {
  if (node.text) return node.text;
  if (!node.children) return '';
  return node.children.map(c => extractTextContent(c)).join('');
}

function evaluateSteps(nodes: XmlNode[], steps: string[], isDescendant: boolean): unknown[] {
  if (steps.length === 0) return nodes;

  const step = steps[0];
  const remaining = steps.slice(1);

  // text() function
  if (step === 'text()') {
    return nodes.map(n => extractTextContent(n));
  }

  // @attribute accessor
  if (step.startsWith('@')) {
    const attrName = step.slice(1);
    return nodes
      .map(n => n.attributes?.[attrName])
      .filter(v => v !== undefined) as string[];
  }

  const parsed = parseStep(step);
  let matched: XmlNode[] = [];

  for (const node of nodes) {
    const candidates = isDescendant
      ? findDescendants(node, parsed.tag)
      : findChildren(node, parsed.tag);

    let filtered = candidates;
    if (parsed.predicate) {
      const posIdx = getPositionalIndex(parsed.predicate);
      if (posIdx !== null) {
        filtered = posIdx <= candidates.length ? [candidates[posIdx - 1]] : [];
      } else {
        filtered = candidates.filter(c => matchesPredicate(c, parsed.predicate!));
      }
    }
    matched.push(...filtered);
  }

  return evaluateSteps(matched, remaining, false);
}

export class XPathMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    config: MapperConfig
  ): unknown {
    const root = (record['__xml'] ?? record) as XmlNode;
    if (!isXmlNode(root)) return null;

    const expr = sourcePath.trim();
    const rawParts = expr.split(/(?=\/)/);
    const steps: { step: string; descendant: boolean }[] = [];

    for (const part of rawParts) {
      if (part === '//') continue;
      if (part.startsWith('//')) {
        steps.push({ step: part.slice(2), descendant: true });
      } else if (part.startsWith('/')) {
        steps.push({ step: part.slice(1), descendant: false });
      } else if (part) {
        steps.push({ step: part, descendant: false });
      }
    }

    let currentNodes: XmlNode[] = [root];
    let resultValues: unknown[] = [];

    for (let i = 0; i < steps.length; i++) {
      const { step, descendant } = steps[i];
      const remaining = [step];
      const evaluated = evaluateSteps(currentNodes, remaining, descendant);
      if (i === steps.length - 1) {
        resultValues = evaluated;
      } else {
        currentNodes = evaluated.filter(isXmlNode);
      }
    }

    if (resultValues.length === 0) return null;
    return resultValues.length === 1 ? resultValues[0] : resultValues;
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'xpath' || pathSyntax === 'xml';
  }
}

export default XPathMapperProvider;
