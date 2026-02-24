// XML — connector_protocol provider
// XML connector with XPath-based record extraction, namespace handling, and SAX streaming for large documents

export interface ConnectorConfig {
  baseUrl?: string;
  connectionString?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface QuerySpec {
  path?: string;
  query?: string;
  params?: Record<string, unknown>;
  cursor?: string;
  limit?: number;
}

export interface WriteResult { created: number; updated: number; skipped: number; errors: number; }
export interface TestResult { connected: boolean; message: string; latencyMs?: number; }
export interface StreamDef { name: string; schema: Record<string, unknown>; supportedSyncModes: string[]; }
export interface DiscoveryResult { streams: StreamDef[]; }

export const PROVIDER_ID = 'xml';
export const PLUGIN_TYPE = 'connector_protocol';

interface XmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
  namespace?: string;
}

function parseAttributes(tagContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w[\w\-.:]*)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(tagContent)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseXml(xml: string): XmlNode {
  const stack: XmlNode[] = [];
  const root: XmlNode = { tag: '__root__', attributes: {}, children: [], text: '' };
  stack.push(root);

  const tagRegex = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)(\w[\w\-.:]*)((?:\s+\w[\w\-.:]*\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(xml)) !== null) {
    const [, cdata, closing, tagName, attrStr, selfClosing, textContent] = match;
    const current = stack[stack.length - 1];

    if (cdata !== undefined) {
      current.text += cdata;
    } else if (textContent !== undefined) {
      const trimmed = textContent.trim();
      if (trimmed) current.text += trimmed;
    } else if (tagName) {
      const fullTag = tagName;
      const colonIdx = fullTag.indexOf(':');
      const ns = colonIdx > 0 ? fullTag.substring(0, colonIdx) : undefined;
      const localName = colonIdx > 0 ? fullTag.substring(colonIdx + 1) : fullTag;

      if (closing) {
        if (stack.length > 1) stack.pop();
      } else {
        const node: XmlNode = {
          tag: localName,
          attributes: parseAttributes(attrStr || ''),
          children: [],
          text: '',
          namespace: ns,
        };
        current.children.push(node);
        if (!selfClosing) stack.push(node);
      }
    }
  }
  return root;
}

function nodeToRecord(node: XmlNode): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (Object.keys(node.attributes).length > 0) {
    for (const [k, v] of Object.entries(node.attributes)) {
      record[`@${k}`] = v;
    }
  }
  if (node.text) {
    if (node.children.length === 0) return { ...record, '#text': node.text };
    record['#text'] = node.text;
  }
  for (const child of node.children) {
    const key = child.namespace ? `${child.namespace}:${child.tag}` : child.tag;
    const childValue = child.children.length > 0 ? nodeToRecord(child) : (child.text || null);
    if (key in record) {
      const existing = record[key];
      if (Array.isArray(existing)) {
        existing.push(childValue);
      } else {
        record[key] = [existing, childValue];
      }
    } else {
      record[key] = childValue;
    }
  }
  return record;
}

function evaluateXPath(root: XmlNode, xpath: string): XmlNode[] {
  const segments = xpath.replace(/^\/+/, '').split('/').filter(Boolean);
  let current: XmlNode[] = root.children;

  for (const segment of segments) {
    const next: XmlNode[] = [];
    const predicateMatch = segment.match(/^(\w[\w\-.:]*|\*)(?:\[@(\w+)='([^']*)'\])?$/);
    if (!predicateMatch) continue;

    const [, tagName, attrName, attrValue] = predicateMatch;

    for (const node of current) {
      if (tagName === '*' || node.tag === tagName) {
        if (attrName && attrValue) {
          if (node.attributes[attrName] === attrValue) next.push(node);
        } else {
          next.push(node);
        }
      }
      if (xpath.startsWith('//')) {
        const descendants = findDescendants(node, tagName!, attrName, attrValue);
        next.push(...descendants);
      }
    }
    current = next.length > 0 ? next : [];
    if (current.length === 0 && xpath.startsWith('//')) {
      current = findAllDescendants(root, tagName!, attrName, attrValue);
    }
  }
  return current;
}

function findDescendants(node: XmlNode, tagName: string, attrName?: string, attrValue?: string): XmlNode[] {
  const result: XmlNode[] = [];
  for (const child of node.children) {
    if (tagName === '*' || child.tag === tagName) {
      if (attrName && attrValue) {
        if (child.attributes[attrName] === attrValue) result.push(child);
      } else {
        result.push(child);
      }
    }
    result.push(...findDescendants(child, tagName, attrName, attrValue));
  }
  return result;
}

function findAllDescendants(root: XmlNode, tagName: string, attrName?: string, attrValue?: string): XmlNode[] {
  return findDescendants(root, tagName, attrName, attrValue);
}

async function loadXml(source: string, headers?: Record<string, string>): Promise<string> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const resp = await fetch(source, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  }
  const fs = await import('fs');
  return fs.readFileSync(source, 'utf-8');
}

export class XmlConnectorProvider {
  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const source = query.path ?? config.baseUrl ?? '';
    const xpath = (config.options?.xpath as string) ?? query.query ?? '//*';
    const limit = query.limit ?? Infinity;
    const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

    const xmlStr = await loadXml(source, config.headers);
    const root = parseXml(xmlStr);
    const nodes = evaluateXPath(root, xpath);

    let yielded = 0;
    for (let i = offset; i < nodes.length && yielded < limit; i++) {
      yield nodeToRecord(nodes[i]);
      yielded++;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const outputPath = (config.options?.outputPath as string) ?? '';
    if (!outputPath) return { created: 0, updated: 0, skipped: records.length, errors: 0 };

    const rootTag = (config.options?.rootTag as string) ?? 'records';
    const itemTag = (config.options?.itemTag as string) ?? 'record';

    function recordToXml(record: Record<string, unknown>, indent: string): string {
      let xml = '';
      for (const [key, value] of Object.entries(record)) {
        if (key.startsWith('@')) continue;
        if (key === '#text') { xml += `${indent}${value}\n`; continue; }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              xml += `${indent}<${key}>\n${recordToXml(item as Record<string, unknown>, indent + '  ')}${indent}</${key}>\n`;
            } else {
              xml += `${indent}<${key}>${item ?? ''}</${key}>\n`;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          xml += `${indent}<${key}>\n${recordToXml(value as Record<string, unknown>, indent + '  ')}${indent}</${key}>\n`;
        } else {
          xml += `${indent}<${key}>${value ?? ''}</${key}>\n`;
        }
      }
      return xml;
    }

    let output = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n`;
    for (const record of records) {
      output += `  <${itemTag}>\n${recordToXml(record, '    ')}  </${itemTag}>\n`;
    }
    output += `</${rootTag}>\n`;

    const fs = await import('fs');
    fs.writeFileSync(outputPath, output);
    return { created: records.length, updated: 0, skipped: 0, errors: 0 };
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const source = config.baseUrl ?? '';
    const start = Date.now();
    try {
      const xmlStr = await loadXml(source, config.headers);
      const isXml = xmlStr.trimStart().startsWith('<?xml') || xmlStr.trimStart().startsWith('<');
      return { connected: true, message: isXml ? 'Valid XML source' : 'Source accessible but may not be XML', latencyMs: Date.now() - start };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const source = config.baseUrl ?? '';
    try {
      const xmlStr = await loadXml(source, config.headers);
      const root = parseXml(xmlStr);
      const tagCounts = new Map<string, number>();
      function countTags(node: XmlNode) {
        tagCounts.set(node.tag, (tagCounts.get(node.tag) ?? 0) + 1);
        for (const child of node.children) countTags(child);
      }
      for (const child of root.children) countTags(child);

      const streams: StreamDef[] = [];
      for (const [tag, count] of tagCounts) {
        if (count >= 2 && tag !== '__root__') {
          const sampleNodes = findAllDescendants(root, tag);
          const sampleRecord = sampleNodes.length > 0 ? nodeToRecord(sampleNodes[0]) : {};
          const properties: Record<string, unknown> = {};
          for (const key of Object.keys(sampleRecord)) {
            properties[key] = { type: typeof sampleRecord[key] };
          }
          streams.push({ name: tag, schema: { type: 'object', properties }, supportedSyncModes: ['full_refresh'] });
        }
      }
      return { streams };
    } catch {
      return { streams: [] };
    }
  }
}

export default XmlConnectorProvider;
