// Data Integration Kit - Web Screenshot Capture Provider
// Visual screenshot capture via headless browser (Puppeteer/Playwright pattern)

export const PROVIDER_ID = 'web_screenshot';
export const PLUGIN_TYPE = 'capture_mode';

export interface CaptureInput {
  url?: string;
  file?: Buffer;
  email?: string;
  shareData?: unknown;
}

export interface CaptureConfig {
  mode: string;
  options?: Record<string, unknown>;
}

export interface SourceMetadata {
  title: string;
  url?: string;
  capturedAt: string;
  contentType: string;
  author?: string;
  tags?: string[];
  source?: string;
}

export interface CaptureItem {
  content: string;
  sourceMetadata: SourceMetadata;
  rawData?: unknown;
}

interface ScreenshotOptions {
  width: number;
  height: number;
  fullPage: boolean;
  selector?: string;
  deviceScaleFactor: number;
  format: 'png' | 'jpeg';
  quality?: number;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
  timeout: number;
  delay: number;
}

interface BrowserPage {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  setViewport(viewport: { width: number; height: number; deviceScaleFactor: number }): Promise<void>;
  title(): Promise<string>;
  screenshot(options: Record<string, unknown>): Promise<Buffer>;
  $(selector: string): Promise<{ screenshot(opts: Record<string, unknown>): Promise<Buffer> } | null>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}

interface Browser {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

function parseScreenshotOptions(config: CaptureConfig): ScreenshotOptions {
  const opts = config.options || {};
  return {
    width: (opts.width as number) || 1280,
    height: (opts.height as number) || 720,
    fullPage: (opts.fullPage as boolean) ?? false,
    selector: opts.selector as string | undefined,
    deviceScaleFactor: (opts.deviceScaleFactor as number) || 2,
    format: (opts.format as 'png' | 'jpeg') || 'png',
    quality: opts.format === 'jpeg' ? ((opts.quality as number) || 80) : undefined,
    waitUntil: (opts.waitUntil as ScreenshotOptions['waitUntil']) || 'networkidle',
    timeout: (opts.timeout as number) || 30000,
    delay: (opts.delay as number) || 0,
  };
}

async function launchBrowser(): Promise<Browser> {
  // Puppeteer/Playwright integration point
  // In production, this would use: const browser = await puppeteer.launch({ headless: true });
  try {
    const puppeteer = await import('puppeteer');
    return await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    }) as unknown as Browser;
  } catch {
    throw new Error('Headless browser (puppeteer) is required for screenshot capture');
  }
}

async function captureScreenshot(
  page: BrowserPage,
  options: ScreenshotOptions
): Promise<Buffer> {
  if (options.selector) {
    const element = await page.$(options.selector);
    if (!element) {
      throw new Error(`Element not found for selector: ${options.selector}`);
    }
    return await element.screenshot({
      type: options.format,
      quality: options.quality,
    }) as Buffer;
  }
  return await page.screenshot({
    type: options.format,
    quality: options.quality,
    fullPage: options.fullPage,
  }) as Buffer;
}

function buildDataUri(buffer: Buffer, format: string): string {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export class WebScreenshotCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.url) throw new Error('web_screenshot capture requires a URL');

    const options = parseScreenshotOptions(config);
    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();

      await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.deviceScaleFactor,
      });

      await page.goto(input.url, {
        waitUntil: options.waitUntil,
        timeout: options.timeout,
      });

      if (options.delay > 0) {
        await page.waitForTimeout(options.delay);
      }

      const pageTitle = await page.title();
      const screenshotBuffer = await captureScreenshot(page, options);
      await page.close();

      const dataUri = buildDataUri(screenshotBuffer, options.format);
      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';

      return {
        content: dataUri,
        sourceMetadata: {
          title: pageTitle || 'Screenshot',
          url: input.url,
          capturedAt: new Date().toISOString(),
          contentType: mimeType,
          tags: [
            'screenshot',
            options.fullPage ? 'full-page' : 'viewport',
            `${options.width}x${options.height}`,
          ],
          source: 'web_screenshot',
        },
        rawData: config.options?.includeBuffer ? screenshotBuffer : undefined,
      };
    } finally {
      await browser.close();
    }
  }

  supports(input: CaptureInput): boolean {
    if (!input.url) return false;
    try {
      const parsed = new URL(input.url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

export default WebScreenshotCaptureProvider;
