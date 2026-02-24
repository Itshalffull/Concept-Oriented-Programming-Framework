// Capture Mode Plugin — capture strategy implementations for the Capture concept
// Provides pluggable content capture from URLs, files, emails, APIs, and OS share intents.
// See Data Integration Kit capture.concept for the parent Capture concept definition.

import Foundation

// MARK: - Core Types

/// Discriminated input describing what to capture.
enum CaptureInput {
    case url(url: URL, selection: ElementSelection?)
    case file(path: String, data: Data, mimeHint: String?)
    case email(raw: String)
    case apiEndpoint(endpointUrl: URL, method: String?, headers: [String: String]?, cursor: String?)
    case shareIntent(text: String?, url: URL?, files: [SharedFile]?)
}

/// A file received via OS share sheet.
struct SharedFile {
    let name: String
    let mimeType: String
    let data: Data
}

/// Selection region for targeted capture (e.g., screenshot of a specific element).
struct ElementSelection: Codable {
    let selector: String
    let rect: CGRect?
}

/// Provider-specific configuration knobs.
struct CaptureConfig: Codable {
    var maxRawBytes: Int?
    var includeRawData: Bool = false
    var timeoutSeconds: TimeInterval = 30
    var providerOptions: [String: [String: AnyCodable]]?
}

/// Metadata about where the captured content came from.
struct SourceMetadata: Codable {
    var sourceUrl: String?
    var title: String?
    var author: String?
    var publishedAt: String?
    var siteName: String?
    var favicon: String?
    var description: String?
    var mimeType: String?
    var language: String?
    let capturedAt: String
    let providerId: String
    var extra: [String: AnyCodable]?
}

/// The product of a capture operation.
struct CaptureItem {
    let content: String
    let sourceMetadata: SourceMetadata
    let rawData: Data?
}

/// Type-erased Codable wrapper for heterogeneous dictionaries.
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let s = try? container.decode(String.self) { value = s }
        else if let i = try? container.decode(Int.self) { value = i }
        else if let d = try? container.decode(Double.self) { value = d }
        else if let b = try? container.decode(Bool.self) { value = b }
        else { value = try container.decode([String: AnyCodable].self) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let s = value as? String { try container.encode(s) }
        else if let i = value as? Int { try container.encode(i) }
        else if let d = value as? Double { try container.encode(d) }
        else if let b = value as? Bool { try container.encode(b) }
        else if let dict = value as? [String: AnyCodable] { try container.encode(dict) }
        else { try container.encodeNil() }
    }
}

// MARK: - Protocol

/// Interface every capture-mode provider must implement.
protocol CaptureModePlugin {
    var id: String { get }
    var displayName: String { get }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem
    func supports(input: CaptureInput) -> Bool
}

// MARK: - Errors

enum CaptureError: Error, LocalizedError {
    case unsupportedInput(provider: String, inputKind: String)
    case networkError(url: String, statusCode: Int?)
    case timeout(url: String, seconds: TimeInterval)
    case parseError(detail: String)
    case noContentFound(url: String)
    case providerUnavailable(id: String)

    var errorDescription: String? {
        switch self {
        case .unsupportedInput(let p, let k): return "\(p) does not support \(k) input"
        case .networkError(let u, let s): return "Network error fetching \(u) (HTTP \(s ?? 0))"
        case .timeout(let u, let s): return "Timeout after \(s)s fetching \(u)"
        case .parseError(let d): return "Parse error: \(d)"
        case .noContentFound(let u): return "No extractable content at \(u)"
        case .providerUnavailable(let id): return "Provider \(id) not available"
        }
    }
}

// MARK: - Helpers

private func iso8601Now() -> String {
    ISO8601DateFormatter().string(from: Date())
}

private func fetchData(from url: URL, timeout: TimeInterval, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
    var request = URLRequest(url: url, timeoutInterval: timeout)
    request.setValue("COPF-Capture/1.0", forHTTPHeaderField: "User-Agent")
    for (key, value) in headers {
        request.setValue(value, forHTTPHeaderField: key)
    }
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
        throw CaptureError.networkError(url: url.absoluteString, statusCode: nil)
    }
    guard (200...299).contains(httpResponse.statusCode) else {
        throw CaptureError.networkError(url: url.absoluteString, statusCode: httpResponse.statusCode)
    }
    return (data, httpResponse)
}

// MARK: - 1. WebArticleProvider — Readability-based article extraction

struct WebArticleProvider: CaptureModePlugin {
    let id = "web_article"
    let displayName = "Web Article (Readability)"

    func supports(input: CaptureInput) -> Bool {
        if case .url(_, let sel) = input { return sel == nil }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .url(let url, _) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-URL")
        }

        let (data, _) = try await fetchData(from: url, timeout: config.timeoutSeconds)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError(detail: "Cannot decode HTML as UTF-8")
        }

        // Readability extraction pipeline:
        // 1. Remove unlikely candidates (scripts, styles, nav, footer, sidebar)
        let cleaned = removeUnlikelyCandidates(html: html)

        // 2. Score block-level elements by text density and structural signals
        let candidates = scoreCandidates(html: cleaned)

        // 3. Select the top-scoring node as article container
        guard let topCandidate = candidates.first else {
            throw CaptureError.noContentFound(url: url.absoluteString)
        }

        // 4. Clean article node: strip remaining ads, forms, social widgets
        let articleContent = cleanArticleContent(topCandidate.html)

        // 5. Convert to plain text preserving paragraph structure
        let plainText = htmlToPlainText(articleContent)

        // 6. Extract metadata from <head> meta tags
        let meta = extractMetadata(html: html, url: url)

        let sourceMetadata = SourceMetadata(
            sourceUrl: url.absoluteString,
            title: meta.title,
            author: meta.author,
            publishedAt: meta.publishedDate,
            siteName: meta.siteName,
            favicon: meta.favicon,
            description: meta.description,
            language: meta.language,
            capturedAt: iso8601Now(),
            providerId: id
        )

        return CaptureItem(
            content: plainText,
            sourceMetadata: sourceMetadata,
            rawData: config.includeRawData ? data : nil
        )
    }

    // -- Readability heuristic helpers --

    private func removeUnlikelyCandidates(html: String) -> String {
        // Remove elements matching negative patterns by class/id:
        // combinator, comment, community, disqus, footer, header, menu,
        // sidebar, sponsor, ad-break, pagination, popup, tweet, twitter
        var result = html

        // Strip script, style, noscript, iframe tags and their contents
        let tagsToRemove = ["script", "style", "noscript", "iframe", "nav", "footer"]
        for tag in tagsToRemove {
            let pattern = "<\(tag)[^>]*>[\\s\\S]*?</\(tag)>"
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    range: NSRange(result.startIndex..., in: result),
                    withTemplate: ""
                )
            }
        }
        return result
    }

    private struct ScoredCandidate {
        let html: String
        let score: Double
    }

    private func scoreCandidates(html: String) -> [ScoredCandidate] {
        // Simplified scoring: extract content between common article containers
        // Score by paragraph count, text length, and class/id bonus
        var candidates: [ScoredCandidate] = []

        let containerPatterns = [
            "<article[^>]*>([\\s\\S]*?)</article>",
            "<div[^>]*(?:class|id)=[\"'][^\"']*(?:article|content|entry|post|story|text|body)[^\"']*[\"'][^>]*>([\\s\\S]*?)</div>",
            "<main[^>]*>([\\s\\S]*?)</main>",
        ]

        for pattern in containerPatterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { continue }
            let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
            for match in matches {
                guard let range = Range(match.range(at: 1), in: html) else { continue }
                let content = String(html[range])

                // Score = paragraph count + text length / 100 + bonus for <article> tag
                let paragraphCount = content.components(separatedBy: "<p").count - 1
                let textLength = content.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).count
                let isArticleTag = pattern.hasPrefix("<article")
                let score = Double(paragraphCount * 2) + Double(textLength) / 100.0 + (isArticleTag ? 25 : 0)

                candidates.append(ScoredCandidate(html: content, score: score))
            }
        }

        // Fallback: use entire <body>
        if candidates.isEmpty {
            let bodyPattern = "<body[^>]*>([\\s\\S]*?)</body>"
            if let regex = try? NSRegularExpression(pattern: bodyPattern, options: .caseInsensitive) {
                let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
                if let match = matches.first, let range = Range(match.range(at: 1), in: html) {
                    candidates.append(ScoredCandidate(html: String(html[range]), score: 1))
                }
            }
        }

        return candidates.sorted { $0.score > $1.score }
    }

    private func cleanArticleContent(_ html: String) -> String {
        // Remove forms, inputs, social share buttons, hidden elements
        var result = html
        let patternsToRemove = [
            "<form[^>]*>[\\s\\S]*?</form>",
            "<input[^>]*/?>",
            "<button[^>]*>[\\s\\S]*?</button>",
            "<div[^>]*(?:class|id)=[\"'][^\"']*(?:share|social|related|comment)[^\"']*[\"'][^>]*>[\\s\\S]*?</div>",
        ]
        for pattern in patternsToRemove {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    range: NSRange(result.startIndex..., in: result),
                    withTemplate: ""
                )
            }
        }
        return result
    }

    private func htmlToPlainText(_ html: String) -> String {
        var text = html
        // Replace block elements with newlines
        let blockElements = ["p", "div", "section", "article", "h[1-6]", "blockquote", "li", "tr"]
        for tag in blockElements {
            if let regex = try? NSRegularExpression(pattern: "</?\(tag)[^>]*>", options: .caseInsensitive) {
                text = regex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n\n")
            }
        }
        // Replace <br> with newline
        if let br = try? NSRegularExpression(pattern: "<br\\s*/?>", options: .caseInsensitive) {
            text = br.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n")
        }
        // Strip remaining tags
        if let tags = try? NSRegularExpression(pattern: "<[^>]+>", options: []) {
            text = tags.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
        }
        // Decode common entities
        text = text.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")

        // Collapse multiple blank lines
        if let collapse = try? NSRegularExpression(pattern: "\\n{3,}") {
            text = collapse.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n\n")
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private struct PageMetadata {
        var title: String
        var author: String?
        var publishedDate: String?
        var siteName: String?
        var favicon: String?
        var description: String?
        var language: String?
    }

    private func extractMetadata(html: String, url: URL) -> PageMetadata {
        func ogContent(_ property: String) -> String? {
            let pattern = "<meta[^>]+property=[\"']og:\(property)[\"'][^>]+content=[\"']([^\"']+)[\"']"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
            let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html))
            guard let range = match.flatMap({ Range($0.range(at: 1), in: html) }) else { return nil }
            return String(html[range])
        }

        func metaName(_ name: String) -> String? {
            let pattern = "<meta[^>]+name=[\"']\(name)[\"'][^>]+content=[\"']([^\"']+)[\"']"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
            let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html))
            guard let range = match.flatMap({ Range($0.range(at: 1), in: html) }) else { return nil }
            return String(html[range])
        }

        func tagContent(_ tag: String) -> String? {
            let pattern = "<\(tag)[^>]*>([^<]+)</\(tag)>"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
            let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html))
            guard let range = match.flatMap({ Range($0.range(at: 1), in: html) }) else { return nil }
            return String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let title = ogContent("title") ?? tagContent("title") ?? "Untitled"
        let author = metaName("author") ?? ogContent("article:author")
        let publishedDate = metaName("article:published_time") ?? ogContent("article:published_time")
        let siteName = ogContent("site_name")
        let description = ogContent("description") ?? metaName("description")

        // Favicon
        let faviconPattern = "<link[^>]+rel=[\"'](?:shortcut )?icon[\"'][^>]+href=[\"']([^\"']+)[\"']"
        var favicon: String?
        if let regex = try? NSRegularExpression(pattern: faviconPattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            let href = String(html[range])
            favicon = URL(string: href, relativeTo: url)?.absoluteString
        }
        if favicon == nil {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.path = "/favicon.ico"
            components?.query = nil
            favicon = components?.url?.absoluteString
        }

        // Language from <html lang="...">
        var language: String?
        let langPattern = "<html[^>]+lang=[\"']([^\"']+)[\"']"
        if let regex = try? NSRegularExpression(pattern: langPattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            language = String(html[range])
        }

        return PageMetadata(
            title: title, author: author, publishedDate: publishedDate,
            siteName: siteName, favicon: favicon, description: description, language: language
        )
    }
}

// MARK: - 2. WebFullPageProvider — Full HTML snapshot

struct WebFullPageProvider: CaptureModePlugin {
    let id = "web_full_page"
    let displayName = "Web Full Page Snapshot"

    func supports(input: CaptureInput) -> Bool {
        if case .url = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .url(let url, _) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-URL")
        }

        let (data, response) = try await fetchData(from: url, timeout: config.timeoutSeconds)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError(detail: "Cannot decode HTML as UTF-8")
        }

        // 1. Resolve relative URLs to absolute
        let resolvedHtml = resolveRelativeUrls(in: html, baseUrl: url)

        // 2. Inline external stylesheets — fetch each <link rel="stylesheet"> and embed as <style>
        let withStyles = await inlineExternalStylesheets(in: resolvedHtml, baseUrl: url, timeout: config.timeoutSeconds)

        // 3. Inject capture metadata
        let timestamp = iso8601Now()
        let metaTags = """
        <meta name="copf:captured-at" content="\(timestamp)" />
        <meta name="copf:source-url" content="\(url.absoluteString)" />
        """
        let finalHtml: String
        if let headRange = withStyles.range(of: "<head>", options: .caseInsensitive) {
            finalHtml = withStyles.replacingCharacters(in: headRange, with: "<head>\n\(metaTags)")
        } else {
            finalHtml = metaTags + "\n" + withStyles
        }

        // Extract title for metadata
        let title = extractTitle(from: html)
        let contentType = response.value(forHTTPHeaderField: "Content-Type") ?? "text/html"

        let sourceMetadata = SourceMetadata(
            sourceUrl: url.absoluteString,
            title: title,
            mimeType: contentType,
            capturedAt: timestamp,
            providerId: id,
            extra: ["sizeBytes": AnyCodable(data.count)]
        )

        return CaptureItem(
            content: finalHtml,
            sourceMetadata: sourceMetadata,
            rawData: config.includeRawData ? data : nil
        )
    }

    private func resolveRelativeUrls(in html: String, baseUrl: URL) -> String {
        // Rewrite src="..." and href="..." from relative to absolute
        guard let regex = try? NSRegularExpression(
            pattern: "(src|href|action)=[\"']([^\"']+)[\"']",
            options: .caseInsensitive
        ) else { return html }

        var result = html
        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))

        // Process in reverse order to preserve ranges
        for match in matches.reversed() {
            guard let attrRange = Range(match.range(at: 1), in: html),
                  let valueRange = Range(match.range(at: 2), in: html),
                  let fullRange = Range(match.range, in: html) else { continue }

            let attr = String(html[attrRange])
            let value = String(html[valueRange])

            if let resolvedUrl = URL(string: value, relativeTo: baseUrl) {
                result = result.replacingCharacters(in: fullRange, with: "\(attr)=\"\(resolvedUrl.absoluteString)\"")
            }
        }
        return result
    }

    private func inlineExternalStylesheets(in html: String, baseUrl: URL, timeout: TimeInterval) async -> String {
        guard let regex = try? NSRegularExpression(
            pattern: "<link[^>]+rel=[\"']stylesheet[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*/?>",
            options: .caseInsensitive
        ) else { return html }

        var result = html
        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))

        for match in matches.reversed() {
            guard let hrefRange = Range(match.range(at: 1), in: html),
                  let fullRange = Range(match.range, in: html) else { continue }

            let href = String(html[hrefRange])
            guard let cssUrl = URL(string: href, relativeTo: baseUrl) else { continue }

            do {
                let (cssData, _) = try await fetchData(from: cssUrl, timeout: timeout)
                if let css = String(data: cssData, encoding: .utf8) {
                    let styleTag = "<style data-source=\"\(cssUrl.absoluteString)\">\n\(css)\n</style>"
                    result = result.replacingCharacters(in: fullRange, with: styleTag)
                }
            } catch {
                // Keep original <link> on failure
            }
        }
        return result
    }

    private func extractTitle(from html: String) -> String {
        let pattern = "<title[^>]*>([^<]+)</title>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return "Untitled" }
        return String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - 3. WebBookmarkProvider — Metadata-only capture

struct WebBookmarkProvider: CaptureModePlugin {
    let id = "web_bookmark"
    let displayName = "Web Bookmark (Metadata Only)"

    func supports(input: CaptureInput) -> Bool {
        if case .url = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .url(let url, _) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-URL")
        }

        let (data, _) = try await fetchData(from: url, timeout: config.timeoutSeconds)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError(detail: "Cannot decode HTML as UTF-8")
        }

        let title = extractOg(html, "title") ?? extractTagContent(html, "title") ?? url.absoluteString
        let description = extractOg(html, "description") ?? extractMeta(html, "description")
        let siteName = extractOg(html, "site_name")
        let image = extractOg(html, "image")
        let favicon = extractFavicon(html, baseUrl: url)
        let canonical = extractCanonical(html) ?? url.absoluteString
        let themeColor = extractMeta(html, "theme-color")

        let bookmarkLines = [
            "# \(title)",
            description.map { "\n> \($0)" },
            "\nURL: \(canonical)",
            siteName.map { "Site: \($0)" },
            image.map { "Image: \($0)" },
            favicon.map { "Favicon: \($0)" },
        ].compactMap { $0 }

        let sourceMetadata = SourceMetadata(
            sourceUrl: canonical,
            title: title,
            siteName: siteName,
            favicon: favicon,
            description: description,
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "themeColor": AnyCodable(themeColor as Any),
                "ogImage": AnyCodable(image as Any),
            ]
        )

        return CaptureItem(
            content: bookmarkLines.joined(separator: "\n"),
            sourceMetadata: sourceMetadata,
            rawData: nil
        )
    }

    private func extractOg(_ html: String, _ property: String) -> String? {
        let pattern = "<meta[^>]+property=[\"']og:\(property)[\"'][^>]+content=[\"']([^\"']+)[\"']"
        return regexFirstCapture(pattern, in: html)
    }

    private func extractMeta(_ html: String, _ name: String) -> String? {
        let pattern = "<meta[^>]+name=[\"']\(name)[\"'][^>]+content=[\"']([^\"']+)[\"']"
        return regexFirstCapture(pattern, in: html)
    }

    private func extractTagContent(_ html: String, _ tag: String) -> String? {
        let pattern = "<\(tag)[^>]*>([^<]+)</\(tag)>"
        return regexFirstCapture(pattern, in: html)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func extractFavicon(_ html: String, baseUrl: URL) -> String? {
        let pattern = "<link[^>]+rel=[\"'](?:shortcut )?icon[\"'][^>]+href=[\"']([^\"']+)[\"']"
        if let href = regexFirstCapture(pattern, in: html) {
            return URL(string: href, relativeTo: baseUrl)?.absoluteString
        }
        var components = URLComponents(url: baseUrl, resolvingAgainstBaseURL: false)
        components?.path = "/favicon.ico"
        components?.query = nil
        return components?.url?.absoluteString
    }

    private func extractCanonical(_ html: String) -> String? {
        let pattern = "<link[^>]+rel=[\"']canonical[\"'][^>]+href=[\"']([^\"']+)[\"']"
        return regexFirstCapture(pattern, in: html)
    }

    private func regexFirstCapture(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return String(text[range])
    }
}

// MARK: - 4. WebScreenshotProvider — Visual screenshot capture

struct WebScreenshotProvider: CaptureModePlugin {
    let id = "web_screenshot"
    let displayName = "Web Screenshot"

    func supports(input: CaptureInput) -> Bool {
        if case .url = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .url(let url, let selection) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-URL")
        }

        let opts = config.providerOptions?["web_screenshot"] ?? [:]
        let format = (opts["format"]?.value as? String) ?? "png"
        let fullPage = (opts["fullPage"]?.value as? Bool) ?? false
        let viewportWidth = (opts["viewportWidth"]?.value as? Int) ?? 1280
        let viewportHeight = (opts["viewportHeight"]?.value as? Int) ?? 800
        let deviceScale = (opts["deviceScaleFactor"]?.value as? Int) ?? 2

        // Use WKWebView (macOS/iOS) to render the page and capture a snapshot
        // In production: load URL in a headless WKWebView, wait for load complete,
        // then call takeSnapshot(with:completionHandler:) or use the
        // WKWebView.pdf() for full page capture

        // Simulated screenshot capture process:
        // 1. Create WKWebView configuration with specified viewport
        // 2. Load URL and wait for didFinish navigation delegate callback
        // 3. If selection provided, scroll to element and capture clip rect
        // 4. If fullPage, set web view to content height before capture
        // 5. Render to CGImage / UIImage, encode as PNG or JPEG

        let screenshotDescription = """
        [Screenshot of \(url.absoluteString)]
        Format: \(format)
        Viewport: \(viewportWidth)x\(viewportHeight)@\(deviceScale)x
        Full page: \(fullPage)
        Selector: \(selection?.selector ?? "none")
        """

        let sourceMetadata = SourceMetadata(
            sourceUrl: url.absoluteString,
            mimeType: "image/\(format)",
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "viewportWidth": AnyCodable(viewportWidth),
                "viewportHeight": AnyCodable(viewportHeight),
                "deviceScaleFactor": AnyCodable(deviceScale),
                "fullPage": AnyCodable(fullPage),
                "selector": AnyCodable(selection?.selector as Any),
            ]
        )

        return CaptureItem(
            content: screenshotDescription,
            sourceMetadata: sourceMetadata,
            rawData: nil  // In production, the actual image bytes
        )
    }
}

// MARK: - 5. WebMarkdownProvider — HTML to Markdown with YAML frontmatter

struct WebMarkdownProvider: CaptureModePlugin {
    let id = "web_markdown"
    let displayName = "Web Markdown (Turndown)"

    func supports(input: CaptureInput) -> Bool {
        if case .url = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .url(let url, _) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-URL")
        }

        let (data, _) = try await fetchData(from: url, timeout: config.timeoutSeconds)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError(detail: "Cannot decode HTML as UTF-8")
        }

        // 1. Extract main article content
        let articleHtml = extractArticleHtml(html)

        // 2. Extract metadata for frontmatter
        let meta = extractPageMetadata(html: html, url: url)

        // 3. Convert HTML to Markdown via Turndown-equivalent rules
        let markdownBody = convertHtmlToMarkdown(articleHtml)

        // 4. Generate YAML frontmatter
        let frontmatter = generateFrontmatter(meta)

        let content = "\(frontmatter)\n\(markdownBody)"

        let sourceMetadata = SourceMetadata(
            sourceUrl: url.absoluteString,
            title: meta.title,
            author: meta.author,
            publishedAt: meta.date,
            siteName: meta.site,
            description: meta.description,
            capturedAt: iso8601Now(),
            providerId: id
        )

        return CaptureItem(
            content: content,
            sourceMetadata: sourceMetadata,
            rawData: config.includeRawData ? data : nil
        )
    }

    private func extractArticleHtml(_ html: String) -> String {
        // Prefer <article>, then <main>, then <body>
        for tag in ["article", "main", "body"] {
            let pattern = "<\(tag)[^>]*>([\\s\\S]*?)</\(tag)>"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
               let range = Range(match.range(at: 1), in: html) {
                return String(html[range])
            }
        }
        return html
    }

    private struct PageMeta {
        var title: String
        var author: String?
        var date: String?
        var site: String?
        var description: String?
        var tags: [String]?
    }

    private func extractPageMetadata(html: String, url: URL) -> PageMeta {
        func og(_ prop: String) -> String? {
            let p = "<meta[^>]+property=[\"']og:\(prop)[\"'][^>]+content=[\"']([^\"']+)[\"']"
            guard let regex = try? NSRegularExpression(pattern: p, options: .caseInsensitive),
                  let m = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                  let r = Range(m.range(at: 1), in: html) else { return nil }
            return String(html[r])
        }
        func meta(_ name: String) -> String? {
            let p = "<meta[^>]+name=[\"']\(name)[\"'][^>]+content=[\"']([^\"']+)[\"']"
            guard let regex = try? NSRegularExpression(pattern: p, options: .caseInsensitive),
                  let m = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                  let r = Range(m.range(at: 1), in: html) else { return nil }
            return String(html[r])
        }

        let titlePattern = "<title[^>]*>([^<]+)</title>"
        var titleFromTag: String?
        if let regex = try? NSRegularExpression(pattern: titlePattern, options: .caseInsensitive),
           let m = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let r = Range(m.range(at: 1), in: html) {
            titleFromTag = String(html[r]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let keywordsStr = meta("keywords")
        let tags = keywordsStr?.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }

        return PageMeta(
            title: og("title") ?? titleFromTag ?? "Untitled",
            author: meta("author") ?? og("article:author"),
            date: meta("article:published_time") ?? og("article:published_time"),
            site: og("site_name"),
            description: og("description") ?? meta("description"),
            tags: tags
        )
    }

    private func convertHtmlToMarkdown(_ html: String) -> String {
        var md = html

        // Headings: <h1>...</h1> -> # ...
        for level in 1...6 {
            let prefix = String(repeating: "#", count: level)
            if let regex = try? NSRegularExpression(pattern: "<h\(level)[^>]*>(.*?)</h\(level)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n\(prefix) $1\n\n")
            }
        }

        // Paragraphs
        if let regex = try? NSRegularExpression(pattern: "<p[^>]*>(.*?)</p>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n$1\n\n")
        }

        // Bold: <strong>/<b>
        for tag in ["strong", "b"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>(.*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "**$1**")
            }
        }

        // Italic: <em>/<i>
        for tag in ["em", "i"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>(.*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "_$1_")
            }
        }

        // Strikethrough: <del>/<s>
        for tag in ["del", "s", "strike"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>(.*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "~~$1~~")
            }
        }

        // Links: <a href="url">text</a> -> [text](url)
        if let regex = try? NSRegularExpression(pattern: "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "[$2]($1)")
        }

        // Images: <img src="url" alt="text"> -> ![text](url)
        if let regex = try? NSRegularExpression(pattern: "<img[^>]+src=[\"']([^\"']+)[\"'][^>]*alt=[\"']([^\"']*)[\"'][^>]*/?>", options: .caseInsensitive) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "![$2]($1)")
        }

        // Code blocks: <pre><code class="language-X">...</code></pre>
        if let regex = try? NSRegularExpression(pattern: "<pre[^>]*><code[^>]*(?:class=[\"'][^\"']*language-(\\w+)[^\"']*[\"'])?[^>]*>(.*?)</code></pre>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n```$1\n$2\n```\n\n")
        }

        // Inline code: <code>...</code>
        if let regex = try? NSRegularExpression(pattern: "<code[^>]*>(.*?)</code>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "`$1`")
        }

        // Blockquote
        if let regex = try? NSRegularExpression(pattern: "<blockquote[^>]*>(.*?)</blockquote>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n> $1\n\n")
        }

        // Unordered list items
        if let regex = try? NSRegularExpression(pattern: "<li[^>]*>(.*?)</li>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "- $1\n")
        }

        // Horizontal rules
        if let regex = try? NSRegularExpression(pattern: "<hr\\s*/?>", options: .caseInsensitive) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n---\n\n")
        }

        // Line breaks
        if let regex = try? NSRegularExpression(pattern: "<br\\s*/?>", options: .caseInsensitive) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n")
        }

        // Strip remaining HTML tags
        if let regex = try? NSRegularExpression(pattern: "<[^>]+>") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "")
        }

        // Decode HTML entities
        md = md.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")

        // Collapse excessive whitespace
        if let regex = try? NSRegularExpression(pattern: "\\n{3,}") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "\n\n")
        }

        return md.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func generateFrontmatter(_ meta: PageMeta) -> String {
        var lines = ["---"]
        lines.append("title: \"\(meta.title.replacingOccurrences(of: "\"", with: "\\\""))\"")
        if let author = meta.author { lines.append("author: \"\(author)\"") }
        if let date = meta.date { lines.append("date: \(date)") }
        if let site = meta.site { lines.append("source: \"\(site)\"") }
        if let desc = meta.description { lines.append("description: \"\(desc.replacingOccurrences(of: "\"", with: "\\\""))\"") }
        if let tags = meta.tags, !tags.isEmpty {
            lines.append("tags:")
            for tag in tags { lines.append("  - \(tag)") }
        }
        lines.append("captured_at: \(iso8601Now())")
        lines.append("---")
        return lines.joined(separator: "\n")
    }
}

// MARK: - 6. FileUploadProvider — Direct file ingestion with MIME detection

struct FileUploadProvider: CaptureModePlugin {
    let id = "file_upload"
    let displayName = "File Upload"

    func supports(input: CaptureInput) -> Bool {
        if case .file = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .file(let path, let data, let mimeHint) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-file")
        }

        // 1. Detect MIME type via magic bytes, then extension, then hint
        let detectedMime = detectMimeByMagicBytes(data)
            ?? detectMimeByExtension(path)
            ?? mimeHint
            ?? "application/octet-stream"

        // 2. File metadata
        let fileName = (path as NSString).lastPathComponent
        let fileExtension = (path as NSString).pathExtension
        let sizeBytes = data.count

        // 3. Content extraction based on type
        let textContent: String
        if detectedMime.hasPrefix("text/") || isTextMime(detectedMime) {
            textContent = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .ascii)
                ?? "[Text content — encoding not recognized]"
        } else if detectedMime == "application/pdf" {
            textContent = extractPdfText(data)
        } else if detectedMime.hasPrefix("image/") {
            textContent = "[Image: \(fileName)] (\(formatBytes(sizeBytes)), \(detectedMime))"
        } else {
            textContent = "[Binary file: \(fileName)] (\(formatBytes(sizeBytes)), \(detectedMime))"
        }

        // 4. Compute SHA-256 hash for deduplication
        let hash = computeSHA256(data)

        let sourceMetadata = SourceMetadata(
            mimeType: detectedMime,
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "fileName": AnyCodable(fileName),
                "extension": AnyCodable(fileExtension),
                "sizeBytes": AnyCodable(sizeBytes),
                "sha256": AnyCodable(hash),
                "originalPath": AnyCodable(path),
            ]
        )

        let maxBytes = config.maxRawBytes ?? 0
        let rawData: Data?
        if config.includeRawData {
            rawData = maxBytes > 0 ? data.prefix(maxBytes) : data
        } else {
            rawData = nil
        }

        return CaptureItem(content: textContent, sourceMetadata: sourceMetadata, rawData: rawData)
    }

    private func detectMimeByMagicBytes(_ data: Data) -> String? {
        guard data.count >= 16 else { return nil }
        let bytes = [UInt8](data.prefix(16))

        // PDF: %PDF
        if bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46 { return "application/pdf" }
        // PNG: 0x89 PNG
        if bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 { return "image/png" }
        // JPEG: FF D8 FF
        if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF { return "image/jpeg" }
        // GIF: GIF8
        if bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 { return "image/gif" }
        // ZIP: PK 03 04
        if bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04 { return "application/zip" }
        // GZIP: 1F 8B
        if bytes[0] == 0x1F && bytes[1] == 0x8B { return "application/gzip" }
        // WebP: RIFF....WEBP
        if bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
            && data.count >= 12
            && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50 { return "image/webp" }

        return nil
    }

    private func detectMimeByExtension(_ path: String) -> String? {
        let ext = (path as NSString).pathExtension.lowercased()
        let map: [String: String] = [
            "txt": "text/plain", "md": "text/markdown", "html": "text/html", "htm": "text/html",
            "css": "text/css", "js": "application/javascript", "ts": "application/typescript",
            "json": "application/json", "xml": "application/xml", "csv": "text/csv",
            "pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
            "mp3": "audio/mpeg", "mp4": "video/mp4", "wav": "audio/wav",
            "zip": "application/zip", "gz": "application/gzip",
            "yaml": "application/yaml", "yml": "application/yaml",
        ]
        return map[ext]
    }

    private func isTextMime(_ mime: String) -> Bool {
        ["application/json", "application/xml", "application/javascript",
         "application/typescript", "application/yaml"].contains(mime)
    }

    private func extractPdfText(_ data: Data) -> String {
        // Use PDFKit on Apple platforms to extract text
        #if canImport(PDFKit)
        if let document = PDFDocument(data: data) {
            var text = ""
            for i in 0..<document.pageCount {
                if let page = document.page(at: i), let pageText = page.string {
                    text += pageText + "\n\n"
                }
            }
            return text.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        #endif
        return "[PDF content — text extraction unavailable on this platform]"
    }

    private func computeSHA256(_ data: Data) -> String {
        // Use CryptoKit on Apple platforms, CommonCrypto as fallback
        #if canImport(CryptoKit)
        import CryptoKit
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        // CommonCrypto fallback
        var hash = [UInt8](repeating: 0, count: 32)
        data.withUnsafeBytes { buffer in
            _ = CC_SHA256(buffer.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
        #endif
    }

    private func formatBytes(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1024 * 1024 { return String(format: "%.1f KB", Double(bytes) / 1024) }
        return String(format: "%.1f MB", Double(bytes) / (1024 * 1024))
    }
}

// MARK: - 7. EmailForwardProvider — Parse forwarded email (RFC 2822)

struct EmailForwardProvider: CaptureModePlugin {
    let id = "email_forward"
    let displayName = "Email Forward (RFC 2822)"

    func supports(input: CaptureInput) -> Bool {
        if case .email = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .email(let raw) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-email")
        }

        // 1. Split headers from body at first blank line (RFC 2822 Section 2.1)
        let parts = raw.components(separatedBy: "\r\n\r\n")
        let headerSection = parts.first ?? ""
        let bodySection = parts.count > 1 ? parts.dropFirst().joined(separator: "\r\n\r\n") : ""

        // 2. Parse headers — unfold continuation lines (RFC 2822 Section 2.2.3)
        let headers = parseHeaders(headerSection)

        // 3. Determine Content-Type and boundary for MIME multipart
        let contentType = headers["content-type"] ?? "text/plain"
        let boundary = extractBoundary(contentType)

        // 4. Parse MIME parts
        var textBody = ""
        var htmlBody = ""
        var attachments: [(name: String, mimeType: String, sizeBytes: Int)] = []

        if let boundary = boundary {
            let mimeParts = splitMimeParts(bodySection, boundary: boundary)
            for part in mimeParts {
                let parsed = parseMimePart(part)
                if parsed.contentType.hasPrefix("text/plain") && !parsed.isAttachment {
                    textBody += decodePartContent(parsed)
                } else if parsed.contentType.hasPrefix("text/html") && !parsed.isAttachment {
                    htmlBody += decodePartContent(parsed)
                } else if parsed.contentType.hasPrefix("multipart/") {
                    // Handle nested multipart
                    if let nestedBoundary = extractBoundary(parsed.contentType) {
                        let nestedParts = splitMimeParts(parsed.body, boundary: nestedBoundary)
                        for np in nestedParts {
                            let nr = parseMimePart(np)
                            if nr.contentType.hasPrefix("text/plain") && !nr.isAttachment {
                                textBody += decodePartContent(nr)
                            } else if nr.contentType.hasPrefix("text/html") && !nr.isAttachment {
                                htmlBody += decodePartContent(nr)
                            } else {
                                attachments.append((
                                    name: nr.filename ?? "untitled",
                                    mimeType: nr.contentType.components(separatedBy: ";").first ?? nr.contentType,
                                    sizeBytes: nr.body.utf8.count
                                ))
                            }
                        }
                    }
                } else {
                    attachments.append((
                        name: parsed.filename ?? "untitled",
                        mimeType: parsed.contentType.components(separatedBy: ";").first ?? parsed.contentType,
                        sizeBytes: parsed.body.utf8.count
                    ))
                }
            }
        } else {
            // Simple single-part message
            let encoding = headers["content-transfer-encoding"] ?? "7bit"
            textBody = decodeBody(bodySection, encoding: encoding)
        }

        // 5. Prefer HTML converted to text, fall back to text/plain
        let mainContent = !htmlBody.isEmpty ? htmlToText(htmlBody) : textBody

        // 6. Decode RFC 2047 encoded-words in headers
        let subject = decodeRfc2047(headers["subject"] ?? "(no subject)")
        let from = decodeRfc2047(headers["from"] ?? "")
        let to = decodeRfc2047(headers["to"] ?? "")
        let date = headers["date"]
        let messageId = headers["message-id"]

        // 7. Build structured content
        var contentLines = [
            "From: \(from)",
            "To: \(to)",
            "Subject: \(subject)",
        ]
        if let date = date { contentLines.append("Date: \(date)") }
        if let messageId = messageId { contentLines.append("Message-ID: \(messageId)") }
        contentLines.append("")
        contentLines.append(mainContent)

        if !attachments.isEmpty {
            contentLines.append("")
            contentLines.append("Attachments (\(attachments.count)):")
            for att in attachments {
                contentLines.append("  - \(att.name) (\(att.mimeType), \(formatBytes(att.sizeBytes)))")
            }
        }

        let content = contentLines.joined(separator: "\n")

        let sourceMetadata = SourceMetadata(
            title: subject,
            author: from,
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "to": AnyCodable(to),
                "date": AnyCodable(date as Any),
                "messageId": AnyCodable(messageId as Any),
                "attachmentCount": AnyCodable(attachments.count),
                "hasHtmlBody": AnyCodable(!htmlBody.isEmpty),
            ]
        )

        return CaptureItem(
            content: content,
            sourceMetadata: sourceMetadata,
            rawData: config.includeRawData ? raw.data(using: .utf8) : nil
        )
    }

    private func parseHeaders(_ section: String) -> [String: String] {
        // Unfold continuation lines
        let unfolded = section.replacingOccurrences(
            of: "\\r\\n([ \\t])",
            with: " ",
            options: .regularExpression
        )
        var headers: [String: String] = [:]
        for line in unfolded.components(separatedBy: "\r\n") {
            guard let colonRange = line.range(of: ":") else { continue }
            let name = String(line[line.startIndex..<colonRange.lowerBound]).trimmingCharacters(in: .whitespaces).lowercased()
            let value = String(line[colonRange.upperBound...]).trimmingCharacters(in: .whitespaces)
            headers[name] = value
        }
        return headers
    }

    private func extractBoundary(_ contentType: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: "boundary=[\"']?([^\"';\\s]+)[\"']?", options: .caseInsensitive),
              let match = regex.firstMatch(in: contentType, range: NSRange(contentType.startIndex..., in: contentType)),
              let range = Range(match.range(at: 1), in: contentType) else { return nil }
        return String(contentType[range])
    }

    private func splitMimeParts(_ body: String, boundary: String) -> [String] {
        let delimiter = "--\(boundary)"
        return body.components(separatedBy: delimiter)
            .dropFirst()  // Preamble
            .filter { !$0.hasPrefix("--") && !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    }

    private struct MimePart {
        let contentType: String
        let encoding: String
        let filename: String?
        let body: String
        let isAttachment: Bool
    }

    private func parseMimePart(_ part: String) -> MimePart {
        let parts = part.components(separatedBy: "\r\n\r\n")
        let headerStr = parts.first ?? ""
        let body = parts.count > 1 ? parts.dropFirst().joined(separator: "\r\n\r\n") : part
        let headers = parseHeaders(headerStr)

        let contentType = headers["content-type"] ?? "text/plain"
        let encoding = headers["content-transfer-encoding"] ?? "7bit"
        let disposition = headers["content-disposition"] ?? ""

        // Extract filename from Content-Disposition or Content-Type name parameter
        var filename: String?
        let fnPattern = "filename=[\"']?([^\"';\\s]+)[\"']?"
        if let regex = try? NSRegularExpression(pattern: fnPattern, options: .caseInsensitive) {
            for searchIn in [disposition, contentType] {
                if let match = regex.firstMatch(in: searchIn, range: NSRange(searchIn.startIndex..., in: searchIn)),
                   let range = Range(match.range(at: 1), in: searchIn) {
                    filename = String(searchIn[range])
                    break
                }
            }
        }

        let isAttachment = disposition.contains("attachment") || filename != nil

        return MimePart(contentType: contentType, encoding: encoding, filename: filename, body: body, isAttachment: isAttachment)
    }

    private func decodePartContent(_ part: MimePart) -> String {
        decodeBody(part.body, encoding: part.encoding)
    }

    private func decodeBody(_ body: String, encoding: String) -> String {
        switch encoding.lowercased() {
        case "base64":
            let cleaned = body.replacingOccurrences(of: "\\s", with: "", options: .regularExpression)
            if let data = Data(base64Encoded: cleaned), let text = String(data: data, encoding: .utf8) {
                return text
            }
            return body
        case "quoted-printable":
            return decodeQuotedPrintable(body)
        default:
            return body
        }
    }

    private func decodeQuotedPrintable(_ text: String) -> String {
        // RFC 2045 Section 6.7
        var result = text
        // Remove soft line breaks
        result = result.replacingOccurrences(of: "=\r\n", with: "")
        result = result.replacingOccurrences(of: "=\n", with: "")
        // Decode =XX hex sequences
        if let regex = try? NSRegularExpression(pattern: "=([0-9A-Fa-f]{2})") {
            let nsString = result as NSString
            let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsString.length))
            for match in matches.reversed() {
                let hexRange = match.range(at: 1)
                let hex = nsString.substring(with: hexRange)
                if let byte = UInt8(hex, radix: 16) {
                    let char = String(UnicodeScalar(byte))
                    result = (result as NSString).replacingCharacters(in: match.range, with: char)
                }
            }
        }
        return result
    }

    private func decodeRfc2047(_ value: String) -> String {
        // RFC 2047 encoded-word: =?charset?encoding?text?=
        guard let regex = try? NSRegularExpression(pattern: "=\\?([^?]+)\\?(Q|B)\\?([^?]+)\\?=", options: .caseInsensitive) else {
            return value
        }
        var result = value
        let matches = regex.matches(in: value, range: NSRange(value.startIndex..., in: value))
        for match in matches.reversed() {
            guard let encRange = Range(match.range(at: 2), in: value),
                  let textRange = Range(match.range(at: 3), in: value),
                  let fullRange = Range(match.range, in: value) else { continue }

            let enc = String(value[encRange]).uppercased()
            let encodedText = String(value[textRange])

            let decoded: String
            if enc == "B" {
                if let data = Data(base64Encoded: encodedText), let text = String(data: data, encoding: .utf8) {
                    decoded = text
                } else {
                    decoded = encodedText
                }
            } else {
                // Q encoding: like quoted-printable, _ = space
                decoded = decodeQuotedPrintable(encodedText.replacingOccurrences(of: "_", with: " "))
            }
            result = result.replacingCharacters(in: fullRange, with: decoded)
        }
        return result
    }

    private func htmlToText(_ html: String) -> String {
        var text = html
        if let br = try? NSRegularExpression(pattern: "<br\\s*/?>", options: .caseInsensitive) {
            text = br.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n")
        }
        if let block = try? NSRegularExpression(pattern: "</?(p|div|h[1-6]|blockquote|li|tr)[^>]*>", options: .caseInsensitive) {
            text = block.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n")
        }
        if let tags = try? NSRegularExpression(pattern: "<[^>]+>") {
            text = tags.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
        }
        text = text.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
        if let collapse = try? NSRegularExpression(pattern: "\\n{3,}") {
            text = collapse.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "\n\n")
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func formatBytes(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1024 * 1024 { return String(format: "%.1f KB", Double(bytes) / 1024) }
        return String(format: "%.1f MB", Double(bytes) / (1024 * 1024))
    }
}

// MARK: - 8. ApiPollProvider — Periodic API query with delta detection

struct ApiPollProvider: CaptureModePlugin {
    let id = "api_poll"
    let displayName = "API Poll (Delta Detection)"

    func supports(input: CaptureInput) -> Bool {
        if case .apiEndpoint = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .apiEndpoint(let endpointUrl, let method, let inputHeaders, let explicitCursor) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-api_endpoint")
        }

        let timeout = config.timeoutSeconds
        let opts = config.providerOptions?["api_poll"] ?? [:]
        let paginationStrategy = (opts["pagination"]?.value as? String) ?? "cursor"
        let deltaStrategy = (opts["delta"]?.value as? String) ?? "watermark"
        let maxPages = (opts["maxPages"]?.value as? Int) ?? 10

        // 1. Build request headers
        var requestHeaders: [String: String] = [
            "Accept": "application/json",
            "User-Agent": "COPF-Capture/1.0",
        ]
        if let extra = inputHeaders { requestHeaders.merge(extra) { _, new in new } }

        // 2. Build initial poll URL with cursor/watermark parameters
        var currentUrl: URL? = buildPollUrl(endpointUrl, cursor: explicitCursor, strategy: paginationStrategy)
        var allItems: [[String: Any]] = []
        var pagesCollected = 0
        var newCursor: String?

        // 3. Paginate through results
        while let url = currentUrl, pagesCollected < maxPages {
            let (data, response) = try await fetchData(from: url, timeout: timeout, headers: requestHeaders)

            // Handle 304 Not Modified
            if response.statusCode == 304 {
                let sourceMetadata = SourceMetadata(
                    sourceUrl: endpointUrl.absoluteString,
                    capturedAt: iso8601Now(),
                    providerId: id,
                    extra: ["deltaDetected": AnyCodable(false), "strategy": AnyCodable(deltaStrategy)]
                )
                return CaptureItem(content: "[]", sourceMetadata: sourceMetadata, rawData: nil)
            }

            guard let jsonObject = try? JSONSerialization.jsonObject(with: data) else {
                throw CaptureError.parseError(detail: "Response is not valid JSON")
            }

            // 4. Extract items from common API response shapes
            let items = extractItems(from: jsonObject)
            allItems.append(contentsOf: items)

            // 5. Extract pagination cursor for next page
            if let body = jsonObject as? [String: Any] {
                newCursor = extractCursor(from: body)
                currentUrl = extractNextPageUrl(from: body, responseHeaders: response, strategy: paginationStrategy, baseUrl: endpointUrl)
            } else {
                currentUrl = nil
            }

            pagesCollected += 1
        }

        // 6. Serialize results
        let jsonData = try JSONSerialization.data(withJSONObject: allItems, options: [.prettyPrinted, .sortedKeys])
        let content = String(data: jsonData, encoding: .utf8) ?? "[]"

        let sourceMetadata = SourceMetadata(
            sourceUrl: endpointUrl.absoluteString,
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "itemCount": AnyCodable(allItems.count),
                "pagesCollected": AnyCodable(pagesCollected),
                "deltaDetected": AnyCodable(!allItems.isEmpty),
                "strategy": AnyCodable(deltaStrategy),
                "pagination": AnyCodable(paginationStrategy),
                "cursor": AnyCodable(newCursor as Any),
            ]
        )

        return CaptureItem(content: content, sourceMetadata: sourceMetadata, rawData: nil)
    }

    private func buildPollUrl(_ baseUrl: URL, cursor: String?, strategy: String) -> URL? {
        guard var components = URLComponents(url: baseUrl, resolvingAgainstBaseURL: false) else { return baseUrl }
        if let cursor = cursor {
            var items = components.queryItems ?? []
            let paramName = strategy == "offset" ? "offset" : "cursor"
            items.append(URLQueryItem(name: paramName, value: cursor))
            components.queryItems = items
        }
        return components.url
    }

    private func extractItems(from json: Any) -> [[String: Any]] {
        // Support common response shapes: { data: [...] }, { results: [...] }, [...]
        if let array = json as? [[String: Any]] { return array }
        if let dict = json as? [String: Any] {
            for key in ["data", "results", "items", "entries", "records"] {
                if let array = dict[key] as? [[String: Any]] { return array }
            }
            return [dict]
        }
        return []
    }

    private func extractCursor(from body: [String: Any]) -> String? {
        for key in ["next_cursor", "nextCursor", "cursor", "offset"] {
            if let value = body[key] {
                if let s = value as? String { return s }
                if let n = value as? Int { return String(n) }
            }
        }
        return nil
    }

    private func extractNextPageUrl(from body: [String: Any], responseHeaders: HTTPURLResponse, strategy: String, baseUrl: URL) -> URL? {
        // Check Link header for rel="next" (RFC 8288)
        if strategy == "link", let linkHeader = responseHeaders.value(forHTTPHeaderField: "Link") {
            let pattern = "<([^>]+)>;\\s*rel=[\"']?next[\"']?"
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: linkHeader, range: NSRange(linkHeader.startIndex..., in: linkHeader)),
               let range = Range(match.range(at: 1), in: linkHeader) {
                return URL(string: String(linkHeader[range]), relativeTo: baseUrl)
            }
        }

        // Check body for next URL
        for key in ["next", "next_page_url", "nextPageUrl"] {
            if let urlStr = body[key] as? String { return URL(string: urlStr, relativeTo: baseUrl) }
        }

        // Check for has_more + cursor
        let hasMore = (body["has_more"] as? Bool) ?? (body["hasMore"] as? Bool) ?? false
        if hasMore, let cursor = extractCursor(from: body) {
            return buildPollUrl(baseUrl, cursor: cursor, strategy: strategy)
        }

        return nil
    }
}

// MARK: - 9. ShareIntentProvider — Mobile/OS share sheet receiver

struct ShareIntentProvider: CaptureModePlugin {
    let id = "share_intent"
    let displayName = "Share Intent (OS Share Sheet)"

    func supports(input: CaptureInput) -> Bool {
        if case .shareIntent = input { return true }
        return false
    }

    func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard case .shareIntent(let text, let url, let files) = input else {
            throw CaptureError.unsupportedInput(provider: id, inputKind: "non-share_intent")
        }

        // 1. Classify the share intent type
        let intentType = classifyIntent(text: text, url: url, files: files)

        // 2. Build content based on what was shared
        var content: String
        var title: String?

        switch intentType {
        case .urlOnly:
            let pageTitle = url != nil ? await fetchPageTitle(url!, timeout: config.timeoutSeconds) : nil
            title = pageTitle ?? url?.absoluteString
            content = [
                pageTitle.map { "# \($0)" },
                url.map { "URL: \($0.absoluteString)" },
            ].compactMap { $0 }.joined(separator: "\n")

        case .urlWithText:
            let pageTitle = url != nil ? await fetchPageTitle(url!, timeout: config.timeoutSeconds) : nil
            title = pageTitle ?? text?.prefix(80).description
            content = [
                pageTitle.map { "# \($0)" },
                url.map { "URL: \($0.absoluteString)" },
                "",
                text,
            ].compactMap { $0 }.joined(separator: "\n")

        case .textOnly:
            title = text?.prefix(80).replacingOccurrences(of: "\n", with: " ")
            content = text ?? ""

        case .filesOnly, .filesWithText:
            let fileUploader = FileUploadProvider()
            var fileResults: [String] = []

            for file in files ?? [] {
                let fileInput = CaptureInput.file(path: file.name, data: file.data, mimeHint: file.mimeType)
                if fileUploader.supports(input: fileInput) {
                    let result = try await fileUploader.capture(input: fileInput, config: config)
                    fileResults.append("## \(file.name)\n\(result.content)")
                }
            }

            title = (files?.count == 1) ? files?.first?.name : "\(files?.count ?? 0) shared files"
            let textPart = text.map { "\($0)\n" } ?? ""
            content = textPart + fileResults.joined(separator: "\n\n")

        case .empty:
            content = ""
            title = "Empty share"
        }

        let sourceMetadata = SourceMetadata(
            sourceUrl: url?.absoluteString,
            title: title,
            capturedAt: iso8601Now(),
            providerId: id,
            extra: [
                "intentType": AnyCodable(intentType.rawValue),
                "hasText": AnyCodable(text != nil),
                "hasUrl": AnyCodable(url != nil),
                "fileCount": AnyCodable(files?.count ?? 0),
                "fileNames": AnyCodable(files?.map { $0.name } as Any),
            ]
        )

        return CaptureItem(content: content, sourceMetadata: sourceMetadata, rawData: nil)
    }

    private enum IntentType: String {
        case urlOnly = "url_only"
        case urlWithText = "url_with_text"
        case textOnly = "text_only"
        case filesOnly = "files_only"
        case filesWithText = "files_with_text"
        case empty = "empty"
    }

    private func classifyIntent(text: String?, url: URL?, files: [SharedFile]?) -> IntentType {
        let hasUrl = url != nil
        let hasText = text != nil && !(text?.isEmpty ?? true)
        let hasFiles = files != nil && !(files?.isEmpty ?? true)

        if hasFiles && hasText { return .filesWithText }
        if hasFiles { return .filesOnly }
        if hasUrl && hasText { return .urlWithText }
        if hasUrl { return .urlOnly }
        if hasText { return .textOnly }
        return .empty
    }

    private func fetchPageTitle(_ url: URL, timeout: TimeInterval) async -> String? {
        do {
            let (data, _) = try await fetchData(from: url, timeout: timeout)
            guard let html = String(data: data, encoding: .utf8) else { return nil }
            let pattern = "<title[^>]*>([^<]+)</title>"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
                  let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                  let range = Range(match.range(at: 1), in: html) else { return nil }
            return String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            return nil
        }
    }
}

// MARK: - Provider Registry

/// All capture mode providers indexed by their unique ID.
let captureModeProviders: [String: any CaptureModePlugin] = [
    "web_article": WebArticleProvider(),
    "web_full_page": WebFullPageProvider(),
    "web_bookmark": WebBookmarkProvider(),
    "web_screenshot": WebScreenshotProvider(),
    "web_markdown": WebMarkdownProvider(),
    "file_upload": FileUploadProvider(),
    "email_forward": EmailForwardProvider(),
    "api_poll": ApiPollProvider(),
    "share_intent": ShareIntentProvider(),
]

/// Resolve the best provider for a given input.
/// Returns the first provider whose `supports()` returns true, preferring
/// more specific providers (checked in registration order).
func resolveProvider(for input: CaptureInput) -> (any CaptureModePlugin)? {
    // Check providers in specificity order
    let orderedIds = [
        "web_article", "web_full_page", "web_bookmark", "web_screenshot",
        "web_markdown", "file_upload", "email_forward", "api_poll", "share_intent",
    ]
    for id in orderedIds {
        if let provider = captureModeProviders[id], provider.supports(input: input) {
            return provider
        }
    }
    return nil
}
