// Qualified reference URI parser tests — namespace, qualifier, and wikilink bracket handling.

import { describe, it, expect } from 'vitest';
import {
  parseQualifiedRef,
  classifyQualifier,
  type QualifiedRef,
} from '../handlers/ts/framework/qualified-ref-parser.js';

describe('classifyQualifier', () => {
  it('classifies sha256 hash qualifiers', () => {
    expect(classifyQualifier('sha256:abc123')).toBe('hash');
    expect(classifyQualifier('sha256:deadbeef0123456789')).toBe('hash');
  });

  it('classifies temporal-date qualifiers', () => {
    expect(classifyQualifier('2026-04-01')).toBe('temporal-date');
    expect(classifyQualifier('1999-12-31')).toBe('temporal-date');
  });

  it('classifies temporal-datetime qualifiers', () => {
    expect(classifyQualifier('2026-04-01T12:00:00Z')).toBe('temporal-datetime');
    expect(classifyQualifier('2026-04-01T00:00')).toBe('temporal-datetime');
  });

  it('classifies keyword qualifiers', () => {
    expect(classifyQualifier('latest')).toBe('keyword');
    expect(classifyQualifier('previous')).toBe('keyword');
  });

  it('classifies version qualifiers as default', () => {
    expect(classifyQualifier('v3')).toBe('version');
    expect(classifyQualifier('v12')).toBe('version');
    expect(classifyQualifier('draft-1')).toBe('version');
    expect(classifyQualifier('rc1')).toBe('version');
  });
});

describe('parseQualifiedRef', () => {
  describe('plain entity ID (no namespace, no qualifier)', () => {
    it('parses a simple entity ID', () => {
      expect(parseQualifiedRef('article-1')).toEqual({ target: 'article-1' });
    });

    it('parses a simple ID with wikilink brackets', () => {
      expect(parseQualifiedRef('[[article-1]]')).toEqual({ target: 'article-1' });
    });

    it('handles empty string', () => {
      expect(parseQualifiedRef('')).toEqual({ target: '' });
    });

    it('handles empty wikilink brackets', () => {
      expect(parseQualifiedRef('[[]]')).toEqual({ target: '' });
    });

    it('trims whitespace', () => {
      expect(parseQualifiedRef('  article-1  ')).toEqual({ target: 'article-1' });
    });

    it('trims whitespace around wikilink brackets', () => {
      expect(parseQualifiedRef('  [[article-1]]  ')).toEqual({ target: 'article-1' });
    });
  });

  describe('namespace only', () => {
    it('parses namespace://target', () => {
      expect(parseQualifiedRef('draft-v2://article-1')).toEqual({
        target: 'article-1',
        namespace: 'draft-v2',
      });
    });

    it('parses namespace with wikilink brackets', () => {
      expect(parseQualifiedRef('[[draft-v2://article-1]]')).toEqual({
        target: 'article-1',
        namespace: 'draft-v2',
      });
    });

    it('handles numeric namespace', () => {
      expect(parseQualifiedRef('ns1://doc')).toEqual({
        target: 'doc',
        namespace: 'ns1',
      });
    });
  });

  describe('qualifier only', () => {
    it('parses target@version', () => {
      expect(parseQualifiedRef('article-1@v3')).toEqual({
        target: 'article-1',
        qualifier: 'v3',
        qualifierKind: 'version',
      });
    });

    it('parses target@temporal-date', () => {
      expect(parseQualifiedRef('article-1@2026-04-01')).toEqual({
        target: 'article-1',
        qualifier: '2026-04-01',
        qualifierKind: 'temporal-date',
      });
    });

    it('parses target@temporal-datetime', () => {
      expect(parseQualifiedRef('article-1@2026-04-01T12:00:00Z')).toEqual({
        target: 'article-1',
        qualifier: '2026-04-01T12:00:00Z',
        qualifierKind: 'temporal-datetime',
      });
    });

    it('parses target@hash', () => {
      expect(parseQualifiedRef('article-1@sha256:abc123')).toEqual({
        target: 'article-1',
        qualifier: 'sha256:abc123',
        qualifierKind: 'hash',
      });
    });

    it('parses target@keyword (latest)', () => {
      expect(parseQualifiedRef('article-1@latest')).toEqual({
        target: 'article-1',
        qualifier: 'latest',
        qualifierKind: 'keyword',
      });
    });

    it('parses target@keyword (previous)', () => {
      expect(parseQualifiedRef('article-1@previous')).toEqual({
        target: 'article-1',
        qualifier: 'previous',
        qualifierKind: 'keyword',
      });
    });

    it('parses qualifier with wikilink brackets', () => {
      expect(parseQualifiedRef('[[article-1@v3]]')).toEqual({
        target: 'article-1',
        qualifier: 'v3',
        qualifierKind: 'version',
      });
    });
  });

  describe('namespace and qualifier combined', () => {
    it('parses namespace://target@version', () => {
      expect(parseQualifiedRef('draft-v2://article-1@v3')).toEqual({
        target: 'article-1',
        namespace: 'draft-v2',
        qualifier: 'v3',
        qualifierKind: 'version',
      });
    });

    it('parses namespace://target@temporal-date', () => {
      expect(parseQualifiedRef('published://article-1@2026-04-01')).toEqual({
        target: 'article-1',
        namespace: 'published',
        qualifier: '2026-04-01',
        qualifierKind: 'temporal-date',
      });
    });

    it('parses namespace://target@hash', () => {
      expect(parseQualifiedRef('archive://doc-5@sha256:deadbeef')).toEqual({
        target: 'doc-5',
        namespace: 'archive',
        qualifier: 'sha256:deadbeef',
        qualifierKind: 'hash',
      });
    });

    it('parses namespace://target@keyword with wikilink brackets', () => {
      expect(parseQualifiedRef('[[staging://page-1@latest]]')).toEqual({
        target: 'page-1',
        namespace: 'staging',
        qualifier: 'latest',
        qualifierKind: 'keyword',
      });
    });

    it('parses full URI with temporal-datetime', () => {
      expect(parseQualifiedRef('draft-v2://article-1@2026-04-01T09:30:00Z')).toEqual({
        target: 'article-1',
        namespace: 'draft-v2',
        qualifier: '2026-04-01T09:30:00Z',
        qualifierKind: 'temporal-datetime',
      });
    });
  });

  describe('edge cases', () => {
    it('handles target with trailing @ (no qualifier value) as plain target', () => {
      // `@` at end with nothing after it — no qualifier extracted
      const result = parseQualifiedRef('article-1@');
      expect(result.target).toBe('article-1@');
      expect(result.qualifier).toBeUndefined();
    });

    it('handles namespace with empty target', () => {
      expect(parseQualifiedRef('ns://')).toEqual({
        target: '',
        namespace: 'ns',
      });
    });

    it('handles namespace with empty target and qualifier', () => {
      expect(parseQualifiedRef('ns://@v1')).toEqual({
        target: '',
        namespace: 'ns',
        qualifier: 'v1',
        qualifierKind: 'version',
      });
    });

    it('does not confuse colons in hash qualifier with namespace delimiter', () => {
      // sha256:abc does not contain `://`, so no namespace is extracted
      const result = parseQualifiedRef('doc@sha256:abc');
      expect(result).toEqual({
        target: 'doc',
        qualifier: 'sha256:abc',
        qualifierKind: 'hash',
      });
    });

    it('handles target containing hyphens and dots', () => {
      expect(parseQualifiedRef('my.doc-v2.draft@v1')).toEqual({
        target: 'my.doc-v2.draft',
        qualifier: 'v1',
        qualifierKind: 'version',
      });
    });
  });
});
