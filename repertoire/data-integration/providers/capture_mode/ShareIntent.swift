// Data Integration Kit - Share Intent Capture Provider
// Mobile/OS share sheet receiver normalizing across iOS NSItemProvider and Android Intent extras

import Foundation

public enum SharePlatform: String {
    case ios, android, web, desktop, unknown
}

public enum ShareContentType: String {
    case text, url, image, file, mixed

    var mimeType: String {
        switch self {
        case .image: return "image/*"
        case .url: return "text/uri-list"
        case .file: return "application/octet-stream"
        case .text, .mixed: return "text/plain"
        }
    }
}

public struct SharedImage {
    public var mimeType: String
    public var width: Int?
    public var height: Int?
}

public struct SharedFile {
    public var mimeType: String
    public var filename: String
    public var size: Int
}

public struct NormalizedShareData {
    public var text: String?
    public var url: String?
    public var title: String?
    public var images: [SharedImage] = []
    public var files: [SharedFile] = []
    public var platform: SharePlatform
    public var contentType: ShareContentType
}

public final class ShareIntentCaptureProvider {
    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let shareData = input.shareData else {
            throw CaptureError.parseError("share_intent capture requires shareData")
        }

        let normalized = normalizeShareData(shareData)

        var contentParts: [String] = []
        if let title = normalized.title { contentParts.append("# \(title)") }
        if let url = normalized.url { contentParts.append("URL: \(url)") }
        if let text = normalized.text { contentParts.append(text) }
        if !normalized.images.isEmpty {
            contentParts.append("\nImages: \(normalized.images.count) shared")
            for (i, img) in normalized.images.enumerated() {
                let dimInfo = img.width.map { " \($0)x\(img.height ?? 0)" } ?? ""
                contentParts.append("  [\(i + 1)] \(img.mimeType)\(dimInfo)")
            }
        }
        if !normalized.files.isEmpty {
            contentParts.append("\nFiles: \(normalized.files.count) shared")
            for (i, file) in normalized.files.enumerated() {
                contentParts.append("  [\(i + 1)] \(file.filename) (\(file.mimeType), \(file.size) bytes)")
            }
        }

        let title = normalized.title
            ?? normalized.url.flatMap { URL(string: $0)?.host }.map { "Shared: \($0)" }
            ?? "Shared Content"

        let content = contentParts.isEmpty ? "(empty share)" : contentParts.joined(separator: "\n")

        var tags = ["share-intent", normalized.platform.rawValue, normalized.contentType.rawValue]
        if !normalized.images.isEmpty { tags.append("has-images") }
        if !normalized.files.isEmpty { tags.append("has-files") }

        return CaptureItem(
            content: content,
            sourceMetadata: SourceMetadata(
                title: title,
                url: normalized.url,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: normalized.contentType.mimeType,
                author: nil,
                tags: tags,
                source: "share_intent"
            ),
            rawData: (config.options?["includeRaw"] as? Bool == true) ? shareData : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        return input.shareData != nil
    }

    // MARK: - Platform Detection

    private func detectPlatform(_ data: Any) -> SharePlatform {
        guard let dict = data as? [String: Any] else { return .unknown }

        // iOS NSItemProvider pattern
        if dict["itemProviders"] != nil || dict["NSExtensionItem"] != nil || dict["UTType"] != nil {
            return .ios
        }
        // Android Intent pattern
        if dict["action"] != nil || dict["EXTRA_TEXT"] != nil || dict["EXTRA_STREAM"] != nil {
            return .android
        }
        // Web Share API
        if dict["title"] != nil && (dict["text"] != nil || dict["url"] != nil) {
            if dict["action"] == nil && dict["itemProviders"] == nil { return .web }
        }
        // Desktop clipboard
        if dict["clipboardData"] != nil || dict["dataTransfer"] != nil {
            return .desktop
        }
        return .unknown
    }

    private func isUrl(_ s: String) -> Bool {
        s.hasPrefix("http://") || s.hasPrefix("https://")
    }

    // MARK: - Platform-Specific Normalization

    private func normalizeShareData(_ shareData: Any) -> NormalizedShareData {
        let platform = detectPlatform(shareData)
        switch platform {
        case .ios: return normalizeIos(shareData)
        case .android: return normalizeAndroid(shareData)
        case .web: return normalizeWeb(shareData)
        default: return normalizeGeneric(shareData, platform: platform)
        }
    }

    private func normalizeIos(_ data: Any) -> NormalizedShareData {
        guard let dict = data as? [String: Any] else {
            return NormalizedShareData(platform: .ios, contentType: .text)
        }

        var result = NormalizedShareData(platform: .ios, contentType: .text)

        // NSExtensionItem title
        if let ext = dict["NSExtensionItem"] as? [String: Any],
           let title = ext["attributedTitle"] as? String {
            result.title = title
        }

        // NSItemProvider items
        let items = (dict["itemProviders"] ?? dict["items"]) as? [[String: Any]] ?? []
        for item in items {
            let uti = (item["UTType"] ?? item["typeIdentifier"]) as? String ?? ""
            let dataStr = item["data"] as? String ?? ""

            if uti.contains("public.url") || uti.contains("public.plain-text") {
                if isUrl(dataStr) {
                    result.url = dataStr
                    result.contentType = .url
                } else {
                    result.text = dataStr
                }
            } else if uti.contains("public.image") {
                let mime = uti.contains("png") ? "image/png" : "image/jpeg"
                result.images.append(SharedImage(mimeType: mime))
                result.contentType = (result.url != nil || result.text != nil) ? .mixed : .image
            } else if uti.contains("public.file-url") || uti.contains("public.data") {
                let mime = item["mimeType"] as? String ?? "application/octet-stream"
                let name = (item["suggestedName"] ?? item["filename"]) as? String ?? "shared-file"
                result.files.append(SharedFile(mimeType: mime, filename: name, size: dataStr.count))
                result.contentType = .file
            }
        }
        return result
    }

    private func normalizeAndroid(_ data: Any) -> NormalizedShareData {
        guard let dict = data as? [String: Any] else {
            return NormalizedShareData(platform: .android, contentType: .text)
        }

        var result = NormalizedShareData(platform: .android, contentType: .text)

        if let text = dict["EXTRA_TEXT"] as? String {
            if isUrl(text) {
                result.url = text
                result.contentType = .url
            } else {
                result.text = text
            }
        }
        if let subject = dict["EXTRA_SUBJECT"] as? String {
            result.title = subject
        }
        if result.text == nil, let html = dict["EXTRA_HTML_TEXT"] as? String {
            result.text = html
        }

        let mimeType = dict["type"] as? String ?? "application/octet-stream"
        if let streams = dict["EXTRA_STREAM"] {
            let streamList: [Any] = (streams as? [Any]) ?? [streams]
            for stream in streamList {
                if mimeType.hasPrefix("image/") {
                    result.images.append(SharedImage(mimeType: mimeType))
                    result.contentType = (result.text != nil || result.url != nil) ? .mixed : .image
                } else {
                    let name = (stream as? [String: Any])?["displayName"] as? String ?? "shared-file"
                    result.files.append(SharedFile(mimeType: mimeType, filename: name, size: 0))
                    result.contentType = .file
                }
            }
        }
        return result
    }

    private func normalizeWeb(_ data: Any) -> NormalizedShareData {
        guard let dict = data as? [String: Any] else {
            return NormalizedShareData(platform: .web, contentType: .text)
        }

        var result = NormalizedShareData(platform: .web, contentType: .text)

        if let t = dict["title"] as? String { result.title = t }
        if let t = dict["text"] as? String { result.text = t }
        if let u = dict["url"] as? String {
            result.url = u
            result.contentType = .url
        }

        // Web Share API Level 2: files
        if let files = dict["files"] as? [[String: Any]] {
            for file in files {
                let name = file["name"] as? String ?? "shared-file"
                let mime = file["type"] as? String ?? "application/octet-stream"
                let size = file["size"] as? Int ?? 0
                result.files.append(SharedFile(mimeType: mime, filename: name, size: size))
            }
            if !result.files.isEmpty {
                result.contentType = (result.url != nil || result.text != nil) ? .mixed : .file
            }
        }
        return result
    }

    private func normalizeGeneric(_ data: Any, platform: SharePlatform) -> NormalizedShareData {
        let dict = data as? [String: Any] ?? [:]
        return NormalizedShareData(
            text: dict["text"] as? String,
            url: dict["url"] as? String,
            title: dict["title"] as? String,
            platform: platform,
            contentType: .text
        )
    }
}
