// Data Integration Kit - Web Screenshot Capture Provider
// Visual screenshot capture via headless browser (WebKit/WKWebView pattern)

import Foundation

public enum ImageFormat {
    case png
    case jpeg(quality: Int)

    var mimeType: String {
        switch self {
        case .png: return "image/png"
        case .jpeg: return "image/jpeg"
        }
    }

    var fileExtension: String {
        switch self {
        case .png: return "png"
        case .jpeg: return "jpeg"
        }
    }
}

public struct ScreenshotOptions {
    public var width: Int
    public var height: Int
    public var fullPage: Bool
    public var selector: String?
    public var deviceScaleFactor: Double
    public var format: ImageFormat
    public var waitUntil: String
    public var timeoutMs: Int
    public var delayMs: Int

    public static var defaults: ScreenshotOptions {
        ScreenshotOptions(
            width: 1280, height: 720, fullPage: false, selector: nil,
            deviceScaleFactor: 2.0, format: .png, waitUntil: "networkidle",
            timeoutMs: 30000, delayMs: 0
        )
    }
}

/// Abstraction over a headless browser engine for screenshot rendering
public protocol HeadlessBrowserEngine {
    func navigate(to url: URL, timeout: Int) async throws
    func setViewport(width: Int, height: Int, scale: Double) async throws
    func getTitle() async throws -> String
    func captureViewport(format: ImageFormat) async throws -> Data
    func captureFullPage(format: ImageFormat) async throws -> Data
    func captureElement(selector: String, format: ImageFormat) async throws -> Data
}

public final class WebScreenshotCaptureProvider {
    private let browserFactory: (() async throws -> HeadlessBrowserEngine)?

    public init(browserFactory: (() async throws -> HeadlessBrowserEngine)? = nil) {
        self.browserFactory = browserFactory
    }

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let urlString = input.url, let url = URL(string: urlString) else {
            throw CaptureError.missingURL
        }

        let options = parseOptions(config: config)

        guard let factory = browserFactory else {
            throw CaptureError.parseError("Headless browser engine not configured for screenshot capture")
        }
        let browser = try await factory()

        try await browser.setViewport(
            width: options.width,
            height: options.height,
            scale: options.deviceScaleFactor
        )

        try await browser.navigate(to: url, timeout: options.timeoutMs)

        if options.delayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(options.delayMs) * 1_000_000)
        }

        let pageTitle = (try? await browser.getTitle()) ?? "Screenshot"

        let screenshotData: Data
        if let selector = options.selector {
            screenshotData = try await browser.captureElement(selector: selector, format: options.format)
        } else if options.fullPage {
            screenshotData = try await browser.captureFullPage(format: options.format)
        } else {
            screenshotData = try await browser.captureViewport(format: options.format)
        }

        let base64 = screenshotData.base64EncodedString()
        let dataUri = "data:\(options.format.mimeType);base64,\(base64)"

        let viewportTag = options.fullPage ? "full-page" : "viewport"
        let dimensionTag = "\(options.width)x\(options.height)"

        return CaptureItem(
            content: dataUri,
            sourceMetadata: SourceMetadata(
                title: pageTitle,
                url: urlString,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: options.format.mimeType,
                author: nil,
                tags: ["screenshot", viewportTag, dimensionTag],
                source: "web_screenshot"
            ),
            rawData: (config.options?["includeBuffer"] as? Bool == true) ? screenshotData : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    private func parseOptions(config: CaptureConfig) -> ScreenshotOptions {
        var opts = ScreenshotOptions.defaults
        guard let configOpts = config.options else { return opts }

        if let w = configOpts["width"] as? Int { opts.width = w }
        if let h = configOpts["height"] as? Int { opts.height = h }
        if let fp = configOpts["fullPage"] as? Bool { opts.fullPage = fp }
        if let sel = configOpts["selector"] as? String { opts.selector = sel }
        if let dsf = configOpts["deviceScaleFactor"] as? Double { opts.deviceScaleFactor = dsf }
        if let fmt = configOpts["format"] as? String {
            let quality = (configOpts["quality"] as? Int) ?? 80
            opts.format = fmt == "jpeg" ? .jpeg(quality: quality) : .png
        }
        if let wu = configOpts["waitUntil"] as? String { opts.waitUntil = wu }
        if let t = configOpts["timeout"] as? Int { opts.timeoutMs = t }
        if let d = configOpts["delay"] as? Int { opts.delayMs = d }

        return opts
    }
}
