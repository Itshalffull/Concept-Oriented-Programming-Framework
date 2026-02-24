// Capture Mode Plugin — capture strategy implementations for the Capture concept
// Provides pluggable content capture from URLs, files, emails, APIs, and OS share intents.
// See Data Integration Kit capture.concept for the parent Capture concept definition.

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Discriminated input describing what to capture. */
export type CaptureInput =
  | { kind: "url"; url: string; selection?: { selector: string; rect?: DOMRect } }
  | { kind: "file"; path: string; buffer: ArrayBuffer; mimeHint?: string }
  | { kind: "email"; raw: string } // RFC 2822 raw message
  | { kind: "api_endpoint"; endpointUrl: string; method?: string; headers?: Record<string, string>; cursor?: string }
  | { kind: "share_intent"; text?: string; url?: string; files?: Array<{ name: string; mimeType: string; data: ArrayBuffer }> };

/** Provider-specific knobs. */
export interface CaptureConfig {
  /** Maximum byte length of raw content to retain (0 = unlimited). */
  maxRawBytes?: number;
  /** Whether to include raw source data alongside processed content. */
  includeRawData?: boolean;
  /** Timeout in milliseconds for network requests. */
  timeoutMs?: number;
  /** Provider-specific options keyed by provider id. */
  providerOptions?: Record<string, Record<string, unknown>>;
}

/** Metadata about where the captured content came from. */
export interface SourceMetadata {
  sourceUrl?: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  siteName?: string;
  favicon?: string;
  description?: string;
  mimeType?: string;
  language?: string;
  capturedAt: string; // ISO-8601
  providerId: string;
  /** Extra provider-specific fields. */
  extra?: Record<string, unknown>;
}

/** The product of a capture operation. */
export interface CaptureItem {
  content: string;
  sourceMetadata: SourceMetadata;
  rawData?: ArrayBuffer;
}

/** Interface every capture-mode provider must implement. */
export interface CaptureModePlugin {
  readonly id: string;
  readonly displayName: string;
  capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem>;
  supports(input: CaptureInput): boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

// ---------------------------------------------------------------------------
// 1. web_article — Readability-based article extraction
// ---------------------------------------------------------------------------

export class WebArticleProvider implements CaptureModePlugin {
  readonly id = "web_article";
  readonly displayName = "Web Article (Readability)";

  supports(input: CaptureInput): boolean {
    return input.kind === "url" && !input.selection;
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "url") throw new Error("web_article requires a URL input");

    const timeout = config.timeoutMs ?? 30_000;
    const html = await this.fetchPage(input.url, timeout);

    // Readability extraction pipeline:
    // 1. Parse HTML into DOM
    const dom = this.parseHTML(html);

    // 2. Pre-process: remove scripts, styles, unlikely candidates
    this.removeUnlikelyCandidates(dom);

    // 3. Score block-level elements by text density, link density, paragraph count
    const candidates = this.scoreCandidates(dom);

    // 4. Select top candidate as article container
    const articleNode = this.selectTopCandidate(candidates);

    // 5. Clean the article node — remove remaining boilerplate, ads, social widgets
    const cleanedHtml = this.cleanArticleNode(articleNode);

    // 6. Extract metadata: title, author, date, site name, description
    const meta = this.extractMetadata(dom, input.url);

    // 7. Convert cleaned article HTML to plain text (preserving paragraph breaks)
    const plainText = this.htmlToPlainText(cleanedHtml);

    const sourceMetadata: SourceMetadata = {
      sourceUrl: input.url,
      title: meta.title,
      author: meta.author,
      publishedAt: meta.publishedDate,
      siteName: meta.siteName,
      favicon: meta.favicon,
      description: meta.description,
      language: meta.language,
      capturedAt: now(),
      providerId: this.id,
    };

    return {
      content: plainText,
      sourceMetadata,
      rawData: config.includeRawData ? textEncoder().encode(html).buffer as ArrayBuffer : undefined,
    };
  }

  // -- Internal helpers (stubs representing real Readability logic) ----------

  private async fetchPage(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "COPF-Capture/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private parseHTML(html: string): Document {
    // In a real implementation this uses DOMParser or jsdom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { JSDOM } = require("jsdom") as any;
    return new JSDOM(html).window.document;
  }

  private removeUnlikelyCandidates(doc: Document): void {
    // Remove elements whose class/id match negative patterns:
    // combinator, comment, community, disqus, extra, foot, header, menu,
    // remark, rss, shoutbox, sidebar, sponsor, ad-break, agegate, pagination,
    // pager, popup, tweet, twitter
    const unlikely = /combinator|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|pagination|pager|popup|tweet|twitter/i;
    const maybe = /and|article|body|column|main|shadow/i;

    const elements = doc.querySelectorAll("*");
    elements.forEach((el) => {
      const classId = `${el.className} ${el.id}`;
      if (unlikely.test(classId) && !maybe.test(classId) && el.tagName !== "BODY") {
        el.parentNode?.removeChild(el);
      }
    });

    // Also strip <script>, <style>, <noscript>, <iframe>
    ["script", "style", "noscript", "iframe"].forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.parentNode?.removeChild(el));
    });
  }

  private scoreCandidates(doc: Document): Array<{ node: Element; score: number }> {
    // Readability scoring heuristic:
    //   - Start with all block elements (div, section, article, p, td, pre, blockquote)
    //   - For each <p> with > 25 chars, add 1 + (comma-count) to parent & grandparent
    //   - Penalize ancestors with high link-to-text ratio (navigation blocks)
    //   - Bonus for elements with class/id matching: article, body, content, entry, main, page, post
    //   - Penalty for: comment, meta, footer, footnote
    const candidates: Array<{ node: Element; score: number }> = [];
    const paragraphs = doc.querySelectorAll("p");
    const scoreMap = new Map<Element, number>();

    paragraphs.forEach((p) => {
      const text = p.textContent ?? "";
      if (text.length < 25) return;

      const parent = p.parentElement;
      const grandparent = parent?.parentElement;
      const commaCount = (text.match(/,/g) ?? []).length;
      const increment = 1 + commaCount + Math.min(Math.floor(text.length / 100), 3);

      if (parent) scoreMap.set(parent, (scoreMap.get(parent) ?? 0) + increment);
      if (grandparent) scoreMap.set(grandparent, (scoreMap.get(grandparent) ?? 0) + increment / 2);
    });

    const positive = /article|body|content|entry|hentry|h-entry|main|page|post|text|blog|story/i;
    const negative = /hidden|banner|combinator|comment|com-|contact|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget/i;

    scoreMap.forEach((score, node) => {
      let adjusted = score;
      const classId = `${node.className} ${node.id}`;
      if (positive.test(classId)) adjusted += 25;
      if (negative.test(classId)) adjusted -= 25;

      // Link density penalty
      const linkText = Array.from(node.querySelectorAll("a")).reduce((acc, a) => acc + (a.textContent?.length ?? 0), 0);
      const totalText = node.textContent?.length ?? 1;
      const linkDensity = linkText / totalText;
      adjusted *= (1 - linkDensity);

      candidates.push({ node, score: adjusted });
    });

    return candidates.sort((a, b) => b.score - a.score);
  }

  private selectTopCandidate(candidates: Array<{ node: Element; score: number }>): Element {
    if (candidates.length === 0) throw new Error("No article content found");
    return candidates[0].node;
  }

  private cleanArticleNode(node: Element): string {
    // Remove remaining non-content elements within the article container:
    //   - Forms, inputs, share buttons, hidden elements
    //   - Elements with negative score patterns in class/id
    //   - Tables that are layout tables (low cell/text ratio)
    const clone = node.cloneNode(true) as Element;
    const remove = clone.querySelectorAll("form, input, button, select, textarea, [aria-hidden='true']");
    remove.forEach((el) => el.parentNode?.removeChild(el));
    return clone.innerHTML;
  }

  private htmlToPlainText(html: string): string {
    // Convert cleaned HTML to readable plain text:
    //   - Replace block elements with double newlines
    //   - Replace <br> with single newlines
    //   - Strip remaining tags
    //   - Collapse whitespace, trim
    return html
      .replace(/<\/?(p|div|section|article|h[1-6]|blockquote|li|tr)[^>]*>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private extractMetadata(doc: Document, url: string): {
    title: string; author?: string; publishedDate?: string;
    siteName?: string; favicon?: string; description?: string; language?: string;
  } {
    const ogMeta = (property: string) =>
      doc.querySelector(`meta[property="og:${property}"]`)?.getAttribute("content") ?? undefined;
    const metaName = (name: string) =>
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? undefined;

    const title =
      ogMeta("title") ??
      doc.querySelector("title")?.textContent?.trim() ??
      "Untitled";

    const author =
      metaName("author") ??
      doc.querySelector('[rel="author"]')?.textContent?.trim() ??
      ogMeta("article:author");

    const publishedDate =
      metaName("article:published_time") ??
      ogMeta("article:published_time") ??
      doc.querySelector("time[datetime]")?.getAttribute("datetime") ??
      undefined;

    const siteName = ogMeta("site_name");
    const description = ogMeta("description") ?? metaName("description");
    const language = doc.documentElement?.getAttribute("lang") ?? undefined;

    const faviconLink = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    const favicon = faviconLink?.getAttribute("href")
      ? new URL(faviconLink.getAttribute("href")!, url).href
      : `${new URL(url).origin}/favicon.ico`;

    return { title, author, publishedDate, siteName, favicon, description, language };
  }
}

// ---------------------------------------------------------------------------
// 2. web_full_page — Full HTML snapshot
// ---------------------------------------------------------------------------

export class WebFullPageProvider implements CaptureModePlugin {
  readonly id = "web_full_page";
  readonly displayName = "Web Full Page Snapshot";

  supports(input: CaptureInput): boolean {
    return input.kind === "url";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "url") throw new Error("web_full_page requires a URL input");

    const timeout = config.timeoutMs ?? 60_000;
    const opts = config.providerOptions?.["web_full_page"] ?? {};
    const inlineImages = opts["inlineImages"] !== false;
    const inlineStyles = opts["inlineStyles"] !== false;

    // 1. Fetch the page HTML
    const html = await this.fetchWithTimeout(input.url, timeout);

    // 2. Parse and resolve all relative URLs to absolute
    const resolvedHtml = this.resolveRelativeUrls(html, input.url);

    // 3. Optionally inline stylesheets (fetch external CSS, embed as <style>)
    const withStyles = inlineStyles
      ? await this.inlineExternalStylesheets(resolvedHtml, input.url, timeout)
      : resolvedHtml;

    // 4. Optionally inline images as base64 data URIs
    const withImages = inlineImages
      ? await this.inlineImagesAsDataUris(withStyles, input.url, timeout)
      : withStyles;

    // 5. Inject capture timestamp and source URL in a <meta> tag
    const finalHtml = this.injectCaptureMetadata(withImages, input.url);

    const sourceMetadata: SourceMetadata = {
      sourceUrl: input.url,
      title: this.extractTitle(finalHtml),
      mimeType: "text/html",
      capturedAt: now(),
      providerId: this.id,
      extra: { inlineImages, inlineStyles, sizeBytes: textEncoder().encode(finalHtml).byteLength },
    };

    return {
      content: finalHtml,
      sourceMetadata,
      rawData: config.includeRawData ? textEncoder().encode(html).buffer as ArrayBuffer : undefined,
    };
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveRelativeUrls(html: string, baseUrl: string): string {
    // Rewrite src="...", href="...", url(...) references from relative to absolute
    const base = new URL(baseUrl);
    return html.replace(/(src|href|action)=["']([^"']+)["']/gi, (_match, attr, value) => {
      try {
        const absolute = new URL(value, base).href;
        return `${attr}="${absolute}"`;
      } catch {
        return `${attr}="${value}"`;
      }
    });
  }

  private async inlineExternalStylesheets(html: string, baseUrl: string, timeoutMs: number): Promise<string> {
    // Find all <link rel="stylesheet" href="..."> tags
    // Fetch each CSS file, replace <link> with <style> containing the CSS
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
    let result = html;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const cssUrl = new URL(match[1], baseUrl).href;
      try {
        const css = await this.fetchWithTimeout(cssUrl, timeoutMs);
        result = result.replace(match[0], `<style data-source="${cssUrl}">\n${css}\n</style>`);
      } catch {
        // Keep the original link if fetch fails
      }
    }
    return result;
  }

  private async inlineImagesAsDataUris(html: string, baseUrl: string, timeoutMs: number): Promise<string> {
    // Find all <img src="..."> tags, fetch binary, convert to data:image/...;base64,...
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let result = html;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgUrl = new URL(match[1], baseUrl).href;
      if (imgUrl.startsWith("data:")) continue; // already inline
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(imgUrl, { signal: controller.signal });
          const buffer = await res.arrayBuffer();
          const mime = res.headers.get("content-type") ?? "image/png";
          const b64 = Buffer.from(buffer).toString("base64");
          result = result.replace(match[1], `data:${mime};base64,${b64}`);
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // Keep original URL on failure
      }
    }
    return result;
  }

  private injectCaptureMetadata(html: string, sourceUrl: string): string {
    const meta = `<meta name="copf:captured-at" content="${now()}" />\n<meta name="copf:source-url" content="${sourceUrl}" />`;
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>\n${meta}`);
    }
    return `${meta}\n${html}`;
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match?.[1]?.trim() ?? "Untitled";
  }
}

// ---------------------------------------------------------------------------
// 3. web_bookmark — Metadata-only capture
// ---------------------------------------------------------------------------

export class WebBookmarkProvider implements CaptureModePlugin {
  readonly id = "web_bookmark";
  readonly displayName = "Web Bookmark (Metadata Only)";

  supports(input: CaptureInput): boolean {
    return input.kind === "url";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "url") throw new Error("web_bookmark requires a URL input");

    const timeout = config.timeoutMs ?? 15_000;
    const html = await this.fetchHead(input.url, timeout);

    // Extract Open Graph, Twitter Card, and standard meta tags
    const title = this.extractOg(html, "title") ?? this.extractTag(html, "title") ?? input.url;
    const description = this.extractOg(html, "description") ?? this.extractMeta(html, "description");
    const image = this.extractOg(html, "image") ?? this.extractMeta(html, "twitter:image");
    const siteName = this.extractOg(html, "site_name");
    const favicon = this.extractFavicon(html, input.url);
    const themeColor = this.extractMeta(html, "theme-color");
    const canonicalUrl = this.extractCanonical(html) ?? input.url;

    const bookmarkContent = [
      `# ${title}`,
      description ? `\n> ${description}` : "",
      `\nURL: ${canonicalUrl}`,
      siteName ? `Site: ${siteName}` : "",
      image ? `Image: ${image}` : "",
      favicon ? `Favicon: ${favicon}` : "",
    ].filter(Boolean).join("\n");

    const sourceMetadata: SourceMetadata = {
      sourceUrl: canonicalUrl,
      title,
      siteName: siteName ?? undefined,
      favicon: favicon ?? undefined,
      description: description ?? undefined,
      capturedAt: now(),
      providerId: this.id,
      extra: { themeColor, ogImage: image },
    };

    return { content: bookmarkContent, sourceMetadata };
  }

  private async fetchHead(url: string, timeoutMs: number): Promise<string> {
    // Only fetch enough to get the <head> section — stop reading after </head>
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (accumulated.length < 64_000) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.includes("</head>")) break;
      }
      reader.cancel();
      return accumulated;
    } finally {
      clearTimeout(timer);
    }
  }

  private extractOg(html: string, property: string): string | undefined {
    const re = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  }

  private extractMeta(html: string, name: string): string | undefined {
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  }

  private extractTag(html: string, tag: string): string | undefined {
    const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i");
    return re.exec(html)?.[1]?.trim();
  }

  private extractFavicon(html: string, baseUrl: string): string | undefined {
    const re = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i;
    const match = re.exec(html);
    if (match) {
      try { return new URL(match[1], baseUrl).href; } catch { /* fall through */ }
    }
    try { return `${new URL(baseUrl).origin}/favicon.ico`; } catch { return undefined; }
  }

  private extractCanonical(html: string): string | undefined {
    const re = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
    return re.exec(html)?.[1];
  }
}

// ---------------------------------------------------------------------------
// 4. web_screenshot — Visual screenshot capture
// ---------------------------------------------------------------------------

export class WebScreenshotProvider implements CaptureModePlugin {
  readonly id = "web_screenshot";
  readonly displayName = "Web Screenshot";

  supports(input: CaptureInput): boolean {
    return input.kind === "url";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "url") throw new Error("web_screenshot requires a URL input");

    const opts = config.providerOptions?.["web_screenshot"] ?? {};
    const format = (opts["format"] as string) ?? "png";
    const fullPage = (opts["fullPage"] as boolean) ?? false;
    const viewportWidth = (opts["viewportWidth"] as number) ?? 1280;
    const viewportHeight = (opts["viewportHeight"] as number) ?? 800;
    const deviceScaleFactor = (opts["deviceScaleFactor"] as number) ?? 2;
    const selector = input.selection?.selector;

    // Launch headless browser (Puppeteer / Playwright abstraction)
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor });
      await page.goto(input.url, { waitUntil: "networkidle0", timeout: config.timeoutMs ?? 30_000 });

      let screenshotBuffer: Buffer;

      if (selector) {
        // Capture a specific element
        const element = await page.$(selector);
        if (!element) throw new Error(`Selector "${selector}" not found on page`);
        screenshotBuffer = await element.screenshot({ type: format as "png" | "jpeg" }) as Buffer;
      } else if (fullPage) {
        screenshotBuffer = await page.screenshot({ type: format as "png" | "jpeg", fullPage: true }) as Buffer;
      } else {
        screenshotBuffer = await page.screenshot({ type: format as "png" | "jpeg" }) as Buffer;
      }

      const title = await page.title();

      const sourceMetadata: SourceMetadata = {
        sourceUrl: input.url,
        title,
        mimeType: `image/${format}`,
        capturedAt: now(),
        providerId: this.id,
        extra: {
          viewport: { width: viewportWidth, height: viewportHeight, deviceScaleFactor },
          fullPage,
          selector,
          sizeBytes: screenshotBuffer.byteLength,
        },
      };

      // Content is base64-encoded image for text representation
      const content = `[Screenshot of ${input.url}]\nFormat: ${format}\nSize: ${screenshotBuffer.byteLength} bytes\nViewport: ${viewportWidth}x${viewportHeight}@${deviceScaleFactor}x`;

      return {
        content,
        sourceMetadata,
        rawData: screenshotBuffer.buffer as ArrayBuffer,
      };
    } finally {
      await browser.close();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async launchBrowser(): Promise<any> {
    // Abstraction over Puppeteer/Playwright — actual implementation selects
    // available browser engine at runtime
    try {
      const puppeteer = require("puppeteer");
      return await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    } catch {
      throw new Error("Screenshot capture requires puppeteer or playwright to be installed");
    }
  }
}

// ---------------------------------------------------------------------------
// 5. web_markdown — HTML to Markdown with YAML frontmatter
// ---------------------------------------------------------------------------

export class WebMarkdownProvider implements CaptureModePlugin {
  readonly id = "web_markdown";
  readonly displayName = "Web Markdown (Turndown)";

  supports(input: CaptureInput): boolean {
    return input.kind === "url";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "url") throw new Error("web_markdown requires a URL input");

    const timeout = config.timeoutMs ?? 30_000;
    const opts = config.providerOptions?.["web_markdown"] ?? {};
    const headingStyle = (opts["headingStyle"] as string) ?? "atx";            // "atx" or "setext"
    const codeBlockStyle = (opts["codeBlockStyle"] as string) ?? "fenced";     // "fenced" or "indented"
    const bulletListMarker = (opts["bulletListMarker"] as string) ?? "-";

    // 1. Fetch page HTML
    const html = await this.fetchPage(input.url, timeout);

    // 2. Extract article content using Readability-like heuristics (reuse logic)
    const articleHtml = this.extractArticleHtml(html);

    // 3. Extract page metadata for YAML frontmatter
    const meta = this.extractPageMetadata(html, input.url);

    // 4. Initialize Turndown service with configuration
    const turndownService = this.createTurndownService({ headingStyle, codeBlockStyle, bulletListMarker });

    // 5. Apply custom Turndown rules
    this.addCustomRules(turndownService);

    // 6. Convert HTML to Markdown
    const markdownBody = turndownService.turndown(articleHtml);

    // 7. Generate YAML frontmatter
    const frontmatter = this.generateFrontmatter(meta);

    // 8. Assemble final Markdown document
    const content = `${frontmatter}\n${markdownBody}`;

    const sourceMetadata: SourceMetadata = {
      sourceUrl: input.url,
      title: meta.title,
      author: meta.author,
      publishedAt: meta.date,
      siteName: meta.site,
      description: meta.description,
      capturedAt: now(),
      providerId: this.id,
    };

    return {
      content,
      sourceMetadata,
      rawData: config.includeRawData ? textEncoder().encode(html).buffer as ArrayBuffer : undefined,
    };
  }

  private async fetchPage(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private extractArticleHtml(html: string): string {
    // Simplified extraction: prefer <article>, then <main>, then <body>
    // Real implementation would use full Readability scoring
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) return articleMatch[1];
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) return mainMatch[1];
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch?.[1] ?? html;
  }

  private extractPageMetadata(html: string, url: string): {
    title: string; author?: string; date?: string; site?: string;
    description?: string; tags?: string[];
  } {
    const og = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
      return m?.[1];
    };
    const meta = (name: string) => {
      const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"));
      return m?.[1];
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    // Extract keywords as tags
    const keywordsStr = meta("keywords");
    const tags = keywordsStr ? keywordsStr.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    return {
      title: og("title") ?? titleMatch?.[1]?.trim() ?? "Untitled",
      author: meta("author") ?? og("article:author"),
      date: meta("article:published_time") ?? og("article:published_time"),
      site: og("site_name"),
      description: og("description") ?? meta("description"),
      tags,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createTurndownService(options: { headingStyle: string; codeBlockStyle: string; bulletListMarker: string }): any {
    // Turndown initialization — in production this uses the turndown npm package
    const TurndownService = require("turndown");
    return new TurndownService({
      headingStyle: options.headingStyle,
      codeBlockStyle: options.codeBlockStyle,
      bulletListMarker: options.bulletListMarker,
      hr: "---",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "referenced",       // Use reference-style links at end of document
      linkReferenceStyle: "full",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCustomRules(service: any): void {
    // Strikethrough support
    service.addRule("strikethrough", {
      filter: ["del", "s", "strike"],
      replacement: (content: string) => `~~${content}~~`,
    });

    // Figure with caption
    service.addRule("figure", {
      filter: "figure",
      replacement: (_content: string, node: Element) => {
        const img = node.querySelector("img");
        const caption = node.querySelector("figcaption");
        const src = img?.getAttribute("src") ?? "";
        const alt = img?.getAttribute("alt") ?? caption?.textContent ?? "";
        return `\n\n![${alt}](${src})\n${caption ? `_${caption.textContent}_` : ""}\n\n`;
      },
    });

    // Code blocks with language detection
    service.addRule("fencedCodeBlock", {
      filter: (node: Element) =>
        node.nodeName === "PRE" && node.querySelector("code") !== null,
      replacement: (_content: string, node: Element) => {
        const code = node.querySelector("code")!;
        const classAttr = code.getAttribute("class") ?? "";
        const langMatch = classAttr.match(/(?:language|lang)-(\w+)/);
        const lang = langMatch?.[1] ?? "";
        const text = code.textContent ?? "";
        return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
      },
    });

    // Highlight / mark
    service.addRule("highlight", {
      filter: "mark",
      replacement: (content: string) => `==${content}==`,
    });
  }

  private generateFrontmatter(meta: {
    title: string; author?: string; date?: string;
    site?: string; description?: string; tags?: string[];
  }): string {
    const lines: string[] = ["---"];
    lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`);
    if (meta.author) lines.push(`author: "${meta.author}"`);
    if (meta.date) lines.push(`date: ${meta.date}`);
    if (meta.site) lines.push(`source: "${meta.site}"`);
    if (meta.description) lines.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
    if (meta.tags && meta.tags.length > 0) {
      lines.push(`tags:`);
      meta.tags.forEach((t) => lines.push(`  - ${t}`));
    }
    lines.push(`captured_at: ${now()}`);
    lines.push("---");
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// 6. file_upload — Direct file ingestion with MIME detection
// ---------------------------------------------------------------------------

export class FileUploadProvider implements CaptureModePlugin {
  readonly id = "file_upload";
  readonly displayName = "File Upload";

  supports(input: CaptureInput): boolean {
    return input.kind === "file";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "file") throw new Error("file_upload requires a file input");

    const { path, buffer, mimeHint } = input;

    // 1. Detect MIME type via magic bytes, falling back to extension, then hint
    const detectedMime = this.detectMimeByMagicBytes(buffer)
      ?? this.detectMimeByExtension(path)
      ?? mimeHint
      ?? "application/octet-stream";

    // 2. Extract file metadata
    const fileName = path.split("/").pop() ?? path.split("\\").pop() ?? "unknown";
    const extension = fileName.includes(".") ? fileName.split(".").pop()! : "";
    const sizeBytes = buffer.byteLength;

    // 3. Content extraction based on detected type
    let textContent: string;
    if (detectedMime.startsWith("text/") || this.isTextMime(detectedMime)) {
      textContent = new TextDecoder("utf-8").decode(buffer);
    } else if (detectedMime === "application/pdf") {
      textContent = await this.extractPdfText(buffer);
    } else if (detectedMime.startsWith("image/")) {
      textContent = `[Image: ${fileName}] (${this.formatBytes(sizeBytes)}, ${detectedMime})`;
    } else if (this.isSpreadsheet(detectedMime)) {
      textContent = await this.extractSpreadsheetPreview(buffer, detectedMime);
    } else if (this.isArchive(detectedMime)) {
      textContent = await this.listArchiveContents(buffer, detectedMime);
    } else {
      textContent = `[Binary file: ${fileName}] (${this.formatBytes(sizeBytes)}, ${detectedMime})`;
    }

    // 4. Compute content hash for deduplication
    const hash = await this.computeHash(buffer);

    const sourceMetadata: SourceMetadata = {
      mimeType: detectedMime,
      capturedAt: now(),
      providerId: this.id,
      extra: {
        fileName,
        extension,
        sizeBytes,
        sha256: hash,
        originalPath: path,
      },
    };

    const maxBytes = config.maxRawBytes ?? 0;
    const rawData = config.includeRawData
      ? (maxBytes > 0 ? buffer.slice(0, maxBytes) : buffer)
      : undefined;

    return { content: textContent, sourceMetadata, rawData };
  }

  private detectMimeByMagicBytes(buffer: ArrayBuffer): string | undefined {
    const bytes = new Uint8Array(buffer.slice(0, 16));
    // PDF: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
    // PNG: 0x89 P N G
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
    // JPEG: 0xFF 0xD8 0xFF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
    // GIF: GIF87a or GIF89a
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    // ZIP (also .xlsx, .docx): PK 0x03 0x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "application/zip";
    // GZIP: 0x1F 0x8B
    if (bytes[0] === 0x1F && bytes[1] === 0x8B) return "application/gzip";
    // WebP: RIFF....WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
    return undefined;
  }

  private detectMimeByExtension(path: string): string | undefined {
    const ext = path.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      txt: "text/plain", md: "text/markdown", html: "text/html", htm: "text/html",
      css: "text/css", js: "application/javascript", ts: "application/typescript",
      json: "application/json", xml: "application/xml", csv: "text/csv",
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
      mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav",
      zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      yaml: "application/yaml", yml: "application/yaml",
    };
    return ext ? map[ext] : undefined;
  }

  private isTextMime(mime: string): boolean {
    return [
      "application/json", "application/xml", "application/javascript",
      "application/typescript", "application/yaml", "application/x-yaml",
    ].includes(mime);
  }

  private isSpreadsheet(mime: string): boolean {
    return mime.includes("spreadsheet") || mime === "text/csv";
  }

  private isArchive(mime: string): boolean {
    return ["application/zip", "application/gzip", "application/x-tar", "application/x-7z-compressed"].includes(mime);
  }

  private async extractPdfText(buffer: ArrayBuffer): Promise<string> {
    // Uses pdf-parse or pdfjs-dist to extract text layer
    try {
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(Buffer.from(buffer));
      return result.text;
    } catch {
      return "[PDF content — text extraction unavailable]";
    }
  }

  private async extractSpreadsheetPreview(buffer: ArrayBuffer, _mime: string): Promise<string> {
    // Uses xlsx/SheetJS to read first sheet, return first 100 rows as TSV
    try {
      const XLSX = require("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_csv(sheet, { FS: "\t" }).split("\n").slice(0, 100).join("\n");
    } catch {
      return "[Spreadsheet content — parsing unavailable]";
    }
  }

  private async listArchiveContents(buffer: ArrayBuffer, _mime: string): Promise<string> {
    // List file entries in archive without full extraction
    try {
      const JSZip = require("jszip");
      const zip = await JSZip.loadAsync(buffer);
      const entries: string[] = [];
      zip.forEach((relativePath: string, entry: { dir: boolean; _data: { uncompressedSize: number } }) => {
        entries.push(`${entry.dir ? "DIR " : "    "}${relativePath}`);
      });
      return `Archive contents (${entries.length} entries):\n${entries.join("\n")}`;
    } catch {
      return "[Archive content — listing unavailable]";
    }
  }

  private async computeHash(buffer: ArrayBuffer): Promise<string> {
    // SHA-256 hash for deduplication
    if (typeof globalThis.crypto?.subtle !== "undefined") {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Node.js fallback
    const { createHash } = require("crypto");
    return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ---------------------------------------------------------------------------
// 7. email_forward — Parse forwarded email (RFC 2822)
// ---------------------------------------------------------------------------

export class EmailForwardProvider implements CaptureModePlugin {
  readonly id = "email_forward";
  readonly displayName = "Email Forward (RFC 2822)";

  supports(input: CaptureInput): boolean {
    return input.kind === "email";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "email") throw new Error("email_forward requires an email input");

    const raw = input.raw;

    // 1. Split headers from body at first blank line (RFC 2822 Section 2.1)
    const headerBodySplit = raw.indexOf("\r\n\r\n");
    const headerSection = headerBodySplit >= 0 ? raw.substring(0, headerBodySplit) : raw;
    const bodySection = headerBodySplit >= 0 ? raw.substring(headerBodySplit + 4) : "";

    // 2. Parse headers — unfold continuation lines (lines starting with whitespace)
    const headers = this.parseHeaders(headerSection);

    // 3. Determine Content-Type and boundary for MIME multipart
    const contentType = headers["content-type"] ?? "text/plain";
    const boundary = this.extractBoundary(contentType);

    // 4. Parse MIME parts
    let textBody = "";
    let htmlBody = "";
    const attachments: Array<{ name: string; mimeType: string; sizeBytes: number; data: ArrayBuffer }> = [];

    if (boundary) {
      // Multipart message — parse each part recursively
      const parts = this.splitMimeParts(bodySection, boundary);
      for (const part of parts) {
        const partResult = this.parseMimePart(part);
        if (partResult.contentType.startsWith("text/plain") && !partResult.isAttachment) {
          textBody += this.decodePartContent(partResult);
        } else if (partResult.contentType.startsWith("text/html") && !partResult.isAttachment) {
          htmlBody += this.decodePartContent(partResult);
        } else if (partResult.contentType.startsWith("multipart/")) {
          // Nested multipart — recurse
          const nestedBoundary = this.extractBoundary(partResult.contentType);
          if (nestedBoundary) {
            const nested = this.splitMimeParts(partResult.body, nestedBoundary);
            for (const np of nested) {
              const nr = this.parseMimePart(np);
              if (nr.contentType.startsWith("text/plain") && !nr.isAttachment) textBody += this.decodePartContent(nr);
              else if (nr.contentType.startsWith("text/html") && !nr.isAttachment) htmlBody += this.decodePartContent(nr);
              else if (nr.isAttachment || !nr.contentType.startsWith("text/")) {
                attachments.push(this.extractAttachment(nr));
              }
            }
          }
        } else {
          // Binary attachment
          attachments.push(this.extractAttachment(partResult));
        }
      }
    } else {
      // Simple single-part message
      const encoding = headers["content-transfer-encoding"] ?? "7bit";
      textBody = this.decodeBody(bodySection, encoding);
    }

    // 5. Prefer HTML converted to text, fall back to text/plain
    const mainContent = htmlBody
      ? this.htmlToText(htmlBody)
      : textBody;

    // 6. Decode encoded-word (RFC 2047) in header values
    const subject = this.decodeRfc2047(headers["subject"] ?? "(no subject)");
    const from = this.decodeRfc2047(headers["from"] ?? "");
    const to = this.decodeRfc2047(headers["to"] ?? "");
    const date = headers["date"];
    const messageId = headers["message-id"];

    // 7. Build structured content
    const attachmentSummary = attachments.length > 0
      ? `\n\nAttachments (${attachments.length}):\n${attachments.map((a) => `  - ${a.name} (${a.mimeType}, ${this.formatBytes(a.sizeBytes)})`).join("\n")}`
      : "";

    const content = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      date ? `Date: ${date}` : "",
      messageId ? `Message-ID: ${messageId}` : "",
      "",
      mainContent,
      attachmentSummary,
    ].filter((line) => line !== undefined).join("\n");

    const sourceMetadata: SourceMetadata = {
      title: subject,
      author: from,
      capturedAt: now(),
      providerId: this.id,
      extra: {
        to,
        date,
        messageId,
        attachmentCount: attachments.length,
        hasHtmlBody: !!htmlBody,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([k]) => !["content-type", "content-transfer-encoding"].includes(k))
        ),
      },
    };

    return {
      content,
      sourceMetadata,
      rawData: config.includeRawData ? textEncoder().encode(raw).buffer as ArrayBuffer : undefined,
    };
  }

  private parseHeaders(headerSection: string): Record<string, string> {
    // Unfold continuation lines (RFC 2822 Section 2.2.3)
    const unfolded = headerSection.replace(/\r\n([ \t])/g, " ");
    const headers: Record<string, string> = {};
    for (const line of unfolded.split("\r\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const name = line.substring(0, colonIdx).trim().toLowerCase();
        const value = line.substring(colonIdx + 1).trim();
        headers[name] = value;
      }
    }
    return headers;
  }

  private extractBoundary(contentType: string): string | undefined {
    const match = contentType.match(/boundary=["']?([^"';\s]+)["']?/i);
    return match?.[1];
  }

  private splitMimeParts(body: string, boundary: string): string[] {
    const delimiter = `--${boundary}`;
    const endDelimiter = `--${boundary}--`;
    const parts = body.split(delimiter);
    // First part is preamble (discard), last part after end delimiter is epilogue (discard)
    return parts
      .slice(1)
      .filter((p) => !p.startsWith("--") && p.trim() !== "")
      .map((p) => p.replace(endDelimiter, "").trim());
  }

  private parseMimePart(part: string): {
    contentType: string; encoding: string; disposition: string;
    filename?: string; body: string; isAttachment: boolean;
  } {
    const split = part.indexOf("\r\n\r\n");
    const headerStr = split >= 0 ? part.substring(0, split) : "";
    const body = split >= 0 ? part.substring(split + 4) : part;
    const headers = this.parseHeaders(headerStr);

    const contentType = headers["content-type"] ?? "text/plain";
    const encoding = headers["content-transfer-encoding"] ?? "7bit";
    const disposition = headers["content-disposition"] ?? "";
    const filenameMatch = disposition.match(/filename=["']?([^"';\s]+)["']?/i)
      ?? contentType.match(/name=["']?([^"';\s]+)["']?/i);
    const isAttachment = disposition.includes("attachment") || !!filenameMatch;

    return { contentType, encoding, disposition, filename: filenameMatch?.[1], body, isAttachment };
  }

  private decodePartContent(part: { body: string; encoding: string }): string {
    return this.decodeBody(part.body, part.encoding);
  }

  private decodeBody(body: string, encoding: string): string {
    switch (encoding.toLowerCase()) {
      case "base64":
        return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
      case "quoted-printable":
        return this.decodeQuotedPrintable(body);
      case "7bit":
      case "8bit":
      case "binary":
      default:
        return body;
    }
  }

  private decodeQuotedPrintable(text: string): string {
    // RFC 2045 Section 6.7: decode =XX hex sequences and soft line breaks (=\r\n)
    return text
      .replace(/=\r?\n/g, "")  // Remove soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  private decodeRfc2047(value: string): string {
    // RFC 2047 encoded-word: =?charset?encoding?text?=
    return value.replace(/=\?([^?]+)\?(Q|B)\?([^?]+)\?=/gi, (_match, _charset, enc, text) => {
      if (enc.toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString("utf-8");
      }
      // Q encoding — like quoted-printable but _ = space
      return text
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    });
  }

  private extractAttachment(part: {
    filename?: string; contentType: string; encoding: string; body: string;
  }): { name: string; mimeType: string; sizeBytes: number; data: ArrayBuffer } {
    let data: Buffer;
    if (part.encoding.toLowerCase() === "base64") {
      data = Buffer.from(part.body.replace(/\s/g, ""), "base64");
    } else {
      data = Buffer.from(part.body, "binary");
    }
    return {
      name: part.filename ?? "untitled",
      mimeType: part.contentType.split(";")[0].trim(),
      sizeBytes: data.byteLength,
      data: data.buffer as ArrayBuffer,
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|blockquote|li|tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ---------------------------------------------------------------------------
// 8. api_poll — Periodic API query with delta detection
// ---------------------------------------------------------------------------

export class ApiPollProvider implements CaptureModePlugin {
  readonly id = "api_poll";
  readonly displayName = "API Poll (Delta Detection)";

  /** Persistent cursor store — in production backed by database. */
  private cursorStore = new Map<string, CursorState>();

  supports(input: CaptureInput): boolean {
    return input.kind === "api_endpoint";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "api_endpoint") throw new Error("api_poll requires an api_endpoint input");

    const { endpointUrl, method, headers: inputHeaders, cursor: explicitCursor } = input;
    const timeout = config.timeoutMs ?? 30_000;
    const opts = config.providerOptions?.["api_poll"] ?? {};
    const paginationStrategy = (opts["pagination"] as string) ?? "cursor";  // cursor | offset | link
    const deltaStrategy = (opts["delta"] as string) ?? "watermark";         // watermark | etag | hash
    const maxPages = (opts["maxPages"] as number) ?? 10;

    // 1. Load existing cursor/watermark state for this endpoint
    const endpointKey = this.endpointKey(endpointUrl);
    const cursorState = this.cursorStore.get(endpointKey) ?? {
      lastCursor: explicitCursor,
      lastEtag: undefined,
      lastHash: undefined,
      lastPollAt: undefined,
    };

    // 2. Build request with delta parameters
    const requestHeaders: Record<string, string> = {
      "Accept": "application/json",
      "User-Agent": "COPF-Capture/1.0",
      ...inputHeaders,
    };

    // Add conditional headers based on delta strategy
    if (deltaStrategy === "etag" && cursorState.lastEtag) {
      requestHeaders["If-None-Match"] = cursorState.lastEtag;
    }

    // 3. Paginate through results collecting all new items
    const allItems: unknown[] = [];
    let currentUrl = this.buildPollUrl(endpointUrl, cursorState, paginationStrategy);
    let pagesCollected = 0;
    let newCursor: string | undefined;
    let newEtag: string | undefined;

    while (currentUrl && pagesCollected < maxPages) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(currentUrl, {
          method: method ?? "GET",
          headers: requestHeaders,
          signal: controller.signal,
        });

        // Handle 304 Not Modified (no new data)
        if (res.status === 304) {
          cursorState.lastPollAt = now();
          this.cursorStore.set(endpointKey, cursorState);
          return {
            content: "[]",
            sourceMetadata: {
              sourceUrl: endpointUrl,
              capturedAt: now(),
              providerId: this.id,
              extra: { deltaDetected: false, strategy: deltaStrategy },
            },
          };
        }

        if (!res.ok) throw new Error(`API returned HTTP ${res.status}: ${await res.text()}`);

        newEtag = res.headers.get("etag") ?? undefined;
        const body = await res.json() as Record<string, unknown>;

        // 4. Extract items from response — supports common API response shapes
        const items = this.extractItems(body);
        allItems.push(...items);

        // 5. Extract next page cursor/link
        const nextPage = this.extractNextPage(body, res.headers, paginationStrategy, endpointUrl);
        newCursor = this.extractCursor(body);
        currentUrl = nextPage;
        pagesCollected++;
      } finally {
        clearTimeout(timer);
      }
    }

    // 6. Apply delta detection — filter out previously seen items
    const newItems = deltaStrategy === "hash"
      ? this.filterByContentHash(allItems, cursorState)
      : allItems;  // watermark/cursor strategies already filter via query params

    // 7. Compute content hash for next poll
    const contentHash = await this.hashItems(newItems);

    // 8. Update cursor state
    const updatedState: CursorState = {
      lastCursor: newCursor ?? cursorState.lastCursor,
      lastEtag: newEtag ?? cursorState.lastEtag,
      lastHash: contentHash,
      lastPollAt: now(),
    };
    this.cursorStore.set(endpointKey, updatedState);

    const content = JSON.stringify(newItems, null, 2);

    const sourceMetadata: SourceMetadata = {
      sourceUrl: endpointUrl,
      capturedAt: now(),
      providerId: this.id,
      extra: {
        itemCount: newItems.length,
        totalFetched: allItems.length,
        pagesCollected,
        deltaDetected: newItems.length > 0,
        strategy: deltaStrategy,
        pagination: paginationStrategy,
        cursor: updatedState.lastCursor,
      },
    };

    return { content, sourceMetadata };
  }

  private endpointKey(url: string): string {
    // Normalize endpoint URL for cursor tracking
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  }

  private buildPollUrl(baseUrl: string, state: CursorState, strategy: string): string {
    const url = new URL(baseUrl);
    if (strategy === "cursor" && state.lastCursor) {
      url.searchParams.set("cursor", state.lastCursor);
    } else if (strategy === "offset" && state.lastCursor) {
      url.searchParams.set("offset", state.lastCursor);
    }
    // For "link" strategy, the URL comes from response headers
    return url.href;
  }

  private extractItems(body: Record<string, unknown>): unknown[] {
    // Support common API response shapes:
    //   { data: [...] }
    //   { results: [...] }
    //   { items: [...] }
    //   [...] (top-level array)
    if (Array.isArray(body)) return body;
    if (Array.isArray(body["data"])) return body["data"];
    if (Array.isArray(body["results"])) return body["results"];
    if (Array.isArray(body["items"])) return body["items"];
    if (Array.isArray(body["entries"])) return body["entries"];
    if (Array.isArray(body["records"])) return body["records"];
    // Wrap single object as array
    return [body];
  }

  private extractNextPage(
    body: Record<string, unknown>,
    headers: Headers,
    strategy: string,
    baseUrl: string,
  ): string | undefined {
    if (strategy === "link") {
      // RFC 8288 Link header: <url>; rel="next"
      const linkHeader = headers.get("link");
      if (linkHeader) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel=["']?next["']?/);
        if (match) return new URL(match[1], baseUrl).href;
      }
    }

    // Check body for pagination pointers
    const nextCursor = body["next_cursor"] ?? body["nextCursor"] ?? body["cursor"];
    const nextUrl = body["next"] ?? body["next_page_url"] ?? body["nextPageUrl"];
    const hasMore = body["has_more"] ?? body["hasMore"] ?? body["has_next"];

    if (typeof nextUrl === "string") return nextUrl;
    if (hasMore && typeof nextCursor === "string") {
      const url = new URL(baseUrl);
      url.searchParams.set(strategy === "offset" ? "offset" : "cursor", nextCursor);
      return url.href;
    }

    return undefined;
  }

  private extractCursor(body: Record<string, unknown>): string | undefined {
    const cursor = body["next_cursor"] ?? body["nextCursor"] ?? body["cursor"] ?? body["offset"];
    return typeof cursor === "string" || typeof cursor === "number" ? String(cursor) : undefined;
  }

  private filterByContentHash(items: unknown[], state: CursorState): unknown[] {
    if (!state.lastHash) return items;
    // Compare individual item hashes to detect truly new items
    // In production this would hash each item and check against stored set
    return items;
  }

  private async hashItems(items: unknown[]): Promise<string> {
    const serialized = JSON.stringify(items);
    if (typeof globalThis.crypto?.subtle !== "undefined") {
      const hash = await crypto.subtle.digest("SHA-256", textEncoder().encode(serialized));
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const { createHash } = require("crypto");
    return createHash("sha256").update(serialized).digest("hex");
  }
}

interface CursorState {
  lastCursor?: string;
  lastEtag?: string;
  lastHash?: string;
  lastPollAt?: string;
}

// ---------------------------------------------------------------------------
// 9. share_intent — Mobile/OS share sheet receiver
// ---------------------------------------------------------------------------

export class ShareIntentProvider implements CaptureModePlugin {
  readonly id = "share_intent";
  readonly displayName = "Share Intent (OS Share Sheet)";

  supports(input: CaptureInput): boolean {
    return input.kind === "share_intent";
  }

  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (input.kind !== "share_intent") throw new Error("share_intent requires share_intent input");

    const { text, url, files } = input;

    // 1. Classify the share intent type
    const intentType = this.classifyIntent(input);

    // 2. Build content based on what was shared
    let content: string;
    let title: string | undefined;

    switch (intentType) {
      case "url_only": {
        // URL shared — fetch basic metadata like bookmark provider
        const pageTitle = url ? await this.fetchPageTitle(url, config.timeoutMs ?? 10_000) : undefined;
        title = pageTitle ?? url;
        content = [
          pageTitle ? `# ${pageTitle}` : "",
          `URL: ${url}`,
        ].filter(Boolean).join("\n");
        break;
      }

      case "url_with_text": {
        // URL with annotation text (e.g., sharing with a comment)
        const pageTitle = url ? await this.fetchPageTitle(url, config.timeoutMs ?? 10_000) : undefined;
        title = pageTitle ?? text?.substring(0, 80);
        content = [
          pageTitle ? `# ${pageTitle}` : "",
          `URL: ${url}`,
          "",
          text,
        ].filter(Boolean).join("\n");
        break;
      }

      case "text_only": {
        // Plain text shared
        title = text?.substring(0, 80).replace(/\n/g, " ");
        content = text ?? "";
        break;
      }

      case "files_only":
      case "files_with_text": {
        // Files shared — process each via FileUploadProvider delegation
        const fileUploader = new FileUploadProvider();
        const fileResults: string[] = [];

        for (const file of files ?? []) {
          const fileInput: CaptureInput = {
            kind: "file",
            path: file.name,
            buffer: file.data,
            mimeHint: file.mimeType,
          };
          if (fileUploader.supports(fileInput)) {
            const result = await fileUploader.capture(fileInput, config);
            fileResults.push(`## ${file.name}\n${result.content}`);
          }
        }

        title = files && files.length === 1
          ? files[0].name
          : `${files?.length ?? 0} shared files`;

        content = [
          text ? `${text}\n` : "",
          ...fileResults,
        ].filter(Boolean).join("\n\n");
        break;
      }

      default:
        content = JSON.stringify({ text, url, fileCount: files?.length ?? 0 });
        title = "Shared content";
    }

    const sourceMetadata: SourceMetadata = {
      sourceUrl: url,
      title,
      capturedAt: now(),
      providerId: this.id,
      extra: {
        intentType,
        hasText: !!text,
        hasUrl: !!url,
        fileCount: files?.length ?? 0,
        fileNames: files?.map((f) => f.name),
      },
    };

    return { content, sourceMetadata };
  }

  private classifyIntent(input: CaptureInput & { kind: "share_intent" }): string {
    const hasUrl = !!input.url;
    const hasText = !!input.text;
    const hasFiles = !!input.files && input.files.length > 0;

    if (hasFiles && hasText) return "files_with_text";
    if (hasFiles) return "files_only";
    if (hasUrl && hasText) return "url_with_text";
    if (hasUrl) return "url_only";
    if (hasText) return "text_only";
    return "empty";
  }

  private async fetchPageTitle(url: string, timeoutMs: number): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        const html = await res.text();
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match?.[1]?.trim();
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** All capture mode providers indexed by their unique ID. */
export const captureModeProviders: ReadonlyMap<string, CaptureModePlugin> = new Map<string, CaptureModePlugin>([
  ["web_article", new WebArticleProvider()],
  ["web_full_page", new WebFullPageProvider()],
  ["web_bookmark", new WebBookmarkProvider()],
  ["web_screenshot", new WebScreenshotProvider()],
  ["web_markdown", new WebMarkdownProvider()],
  ["file_upload", new FileUploadProvider()],
  ["email_forward", new EmailForwardProvider()],
  ["api_poll", new ApiPollProvider()],
  ["share_intent", new ShareIntentProvider()],
]);

/**
 * Resolve the best provider for a given input.
 * Returns the first provider whose `supports()` returns true, preferring
 * more specific providers (checked in registration order).
 */
export function resolveProvider(input: CaptureInput): CaptureModePlugin | undefined {
  for (const [, provider] of captureModeProviders) {
    if (provider.supports(input)) return provider;
  }
  return undefined;
}
