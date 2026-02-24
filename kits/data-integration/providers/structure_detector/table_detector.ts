// Table detector — detects tabular structure in text content
// Supports: Markdown pipe tables, TSV, space-aligned columns, HTML tables

export const PROVIDER_ID = 'table_detector';
export const PLUGIN_TYPE = 'structure_detector';

export interface DetectorConfig {
  options?: Record<string, unknown>;
  confidenceThreshold?: number;
}

export interface Detection {
  field: string;
  value: unknown;
  type: string;
  confidence: number;
  evidence: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
  format: string;
}

function parsePipeTable(lines: string[]): TableData | null {
  // Find runs of pipe-delimited lines (at least header + separator + 1 row)
  const pipeLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      pipeLines.push(trimmed);
    } else if (pipeLines.length >= 2) {
      break;
    } else {
      pipeLines.length = 0;
    }
  }
  if (pipeLines.length < 3) return null;

  // Check for separator row (second line should be like |---|---|)
  const sepLine = pipeLines[1];
  const isSeparator = /^[|\s:-]+$/.test(sepLine);
  if (!isSeparator) return null;

  const splitRow = (row: string): string[] =>
    row.split('|').map(c => c.trim()).filter((_, i, arr) =>
      i > 0 && i < arr.length - (row.endsWith('|') ? 1 : 0)
    );

  const headers = splitRow(pipeLines[0]);
  const rows: string[][] = [];
  for (let i = 2; i < pipeLines.length; i++) {
    rows.push(splitRow(pipeLines[i]));
  }

  return { headers, rows, format: 'markdown_pipe' };
}

function parseTsvTable(lines: string[]): TableData | null {
  const tsvLines = lines.filter(l => l.includes('\t') && l.split('\t').length >= 2);
  if (tsvLines.length < 2) return null;

  const colCount = tsvLines[0].split('\t').length;
  // Verify consistent column count
  const consistent = tsvLines.every(l => l.split('\t').length === colCount);
  if (!consistent) return null;

  const headers = tsvLines[0].split('\t').map(c => c.trim());
  const rows = tsvLines.slice(1).map(l => l.split('\t').map(c => c.trim()));

  return { headers, rows, format: 'tsv' };
}

function parseSpaceAligned(lines: string[]): TableData | null {
  // Detect columns by consistent spacing patterns
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 3) return null;

  // Find column boundaries by locating positions where multiple spaces appear consistently
  const firstLine = nonEmpty[0];
  const gapPattern = /\s{2,}/g;
  const gaps: number[] = [];
  let gapMatch: RegExpExecArray | null;
  while ((gapMatch = gapPattern.exec(firstLine)) !== null) {
    gaps.push(gapMatch.index + gapMatch[0].length);
  }
  if (gaps.length < 1) return null;

  // Verify gaps are consistent across lines (within tolerance)
  let alignedCount = 0;
  for (let i = 1; i < Math.min(nonEmpty.length, 6); i++) {
    let matched = 0;
    for (const gap of gaps) {
      if (gap < nonEmpty[i].length && /\s/.test(nonEmpty[i][gap - 1] ?? '')) {
        matched++;
      }
    }
    if (matched >= gaps.length * 0.6) alignedCount++;
  }
  if (alignedCount < 2) return null;

  const boundaries = [0, ...gaps, Infinity];
  const extractRow = (line: string): string[] => {
    const cells: string[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = Math.min(boundaries[i + 1], line.length);
      cells.push((line.slice(start, end) ?? '').trim());
    }
    return cells;
  };

  const headers = extractRow(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map(extractRow);

  return { headers, rows, format: 'space_aligned' };
}

function parseHtmlTable(text: string): TableData | null {
  const tableMatch = text.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const tableContent = tableMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

  const allRows: string[][] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length > 0) allRows.push(cells);
  }

  if (allRows.length < 2) return null;
  return { headers: allRows[0], rows: allRows.slice(1), format: 'html' };
}

export class TableDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];
    const lines = text.split(/\r?\n/);

    const parsers: Array<{ parse: (lines: string[]) => TableData | null; baseConfidence: number }> = [
      { parse: parsePipeTable, baseConfidence: 0.95 },
      { parse: parseTsvTable, baseConfidence: 0.90 },
      { parse: parseSpaceAligned, baseConfidence: 0.75 },
    ];

    for (const parser of parsers) {
      const table = parser.parse(lines);
      if (!table) continue;

      // Adjust confidence based on consistency
      const rowLengths = table.rows.map(r => r.length);
      const headerLen = table.headers.length;
      const consistent = rowLengths.every(l => l === headerLen);
      const confidence = consistent
        ? parser.baseConfidence
        : parser.baseConfidence - 0.10;

      if (confidence < threshold) continue;

      detections.push({
        field: 'table',
        value: { headers: table.headers, rows: table.rows, format: table.format },
        type: 'table',
        confidence,
        evidence: `${table.format} table: ${table.headers.length} columns, ${table.rows.length} rows`,
      });
    }

    // HTML table detection
    const htmlTable = parseHtmlTable(text);
    if (htmlTable) {
      const confidence = 0.92;
      if (confidence >= threshold) {
        detections.push({
          field: 'table',
          value: { headers: htmlTable.headers, rows: htmlTable.rows, format: htmlTable.format },
          type: 'table',
          confidence,
          evidence: `HTML table: ${htmlTable.headers.length} columns, ${htmlTable.rows.length} rows`,
        });
      }
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown', 'text/csv', 'text/tab-separated-values'].includes(contentType);
  }
}

export default TableDetectorProvider;
