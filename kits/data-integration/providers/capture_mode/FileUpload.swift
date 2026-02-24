// Data Integration Kit - File Upload Capture Provider
// Direct file ingestion with MIME detection via magic bytes and metadata extraction

import Foundation

public final class FileUploadCaptureProvider {

    private struct MagicSignature {
        let bytes: [UInt8]
        let offset: Int
        let mimeType: String
        let fileExtension: String
    }

    private static let signatures: [MagicSignature] = [
        MagicSignature(bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: "image/png", fileExtension: "png"),
        MagicSignature(bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: "image/jpeg", fileExtension: "jpg"),
        MagicSignature(bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0, mimeType: "image/gif", fileExtension: "gif"),
        MagicSignature(bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0, mimeType: "image/gif", fileExtension: "gif"),
        MagicSignature(bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: "application/pdf", fileExtension: "pdf"),
        MagicSignature(bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: "application/zip", fileExtension: "zip"),
        MagicSignature(bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: "image/webp", fileExtension: "webp"),
        MagicSignature(bytes: [0x42, 0x4D], offset: 0, mimeType: "image/bmp", fileExtension: "bmp"),
        MagicSignature(bytes: [0x49, 0x44, 0x33], offset: 0, mimeType: "audio/mpeg", fileExtension: "mp3"),
        MagicSignature(bytes: [0x66, 0x4C, 0x61, 0x43], offset: 0, mimeType: "audio/flac", fileExtension: "flac"),
        MagicSignature(bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0, mimeType: "audio/ogg", fileExtension: "ogg"),
        MagicSignature(bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, mimeType: "video/webm", fileExtension: "webm"),
    ]

    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let fileData = input.file, !fileData.isEmpty else {
            throw CaptureError.parseError("file_upload capture requires a file buffer")
        }

        let (mimeType, ext) = detectMimeType(data: fileData)
        let fileSize = fileData.count
        let filename = (config.options?["filename"] as? String) ?? "upload.\(ext)"

        let dimensions: (width: Int, height: Int)?
        if mimeType.hasPrefix("image/") {
            dimensions = extractImageDimensions(data: fileData, mimeType: mimeType)
        } else {
            dimensions = nil
        }

        var summaryParts = [
            "File: \(filename)",
            "Type: \(mimeType)",
            "Size: \(formatFileSize(bytes: fileSize))"
        ]
        if let dims = dimensions {
            summaryParts.append("Dimensions: \(dims.width)x\(dims.height)")
        }

        let isText = mimeType.hasPrefix("text/") || mimeType == "application/json"
        let content: String
        if isText && fileSize < 1_048_576 {
            content = String(data: fileData, encoding: .utf8) ?? summaryParts.joined(separator: "\n")
        } else {
            content = summaryParts.joined(separator: "\n")
        }

        var tags = [ext, String(mimeType.split(separator: "/").first ?? "file")]
        if let dims = dimensions {
            tags.append("\(dims.width)x\(dims.height)")
        }

        return CaptureItem(
            content: content,
            sourceMetadata: SourceMetadata(
                title: filename,
                url: nil,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: mimeType,
                author: nil,
                tags: tags,
                source: "file_upload"
            ),
            rawData: (config.options?["includeBuffer"] as? Bool == true)
                ? ["data": fileData, "dimensions": dimensions as Any, "detectedMime": mimeType] as [String: Any]
                : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let file = input.file else { return false }
        return !file.isEmpty
    }

    // MARK: - MIME Detection via Magic Bytes

    private func detectMimeType(data: Data) -> (mimeType: String, extension: String) {
        let bytes = [UInt8](data)
        for sig in Self.signatures {
            if bytes.count < sig.offset + sig.bytes.count { continue }
            let slice = Array(bytes[sig.offset..<sig.offset + sig.bytes.count])
            if slice == sig.bytes {
                return (sig.mimeType, sig.fileExtension)
            }
        }

        // Check text-based formats
        if let header = String(data: data.prefix(512), encoding: .utf8) {
            let trimmed = header.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("<?xml") || trimmed.hasPrefix("<svg") {
                return ("image/svg+xml", "svg")
            }
            if trimmed.hasPrefix("<!DOCTYPE html") || trimmed.hasPrefix("<html") {
                return ("text/html", "html")
            }
            if trimmed.hasPrefix("{") || trimmed.hasPrefix("[") {
                return ("application/json", "json")
            }
        }
        if String(data: data, encoding: .utf8) != nil {
            return ("text/plain", "txt")
        }
        return ("application/octet-stream", "bin")
    }

    // MARK: - Image Dimension Extraction

    private func extractImageDimensions(data: Data, mimeType: String) -> (width: Int, height: Int)? {
        let bytes = [UInt8](data)
        switch mimeType {
        case "image/png":
            return extractPngDimensions(bytes: bytes)
        case "image/jpeg":
            return extractJpegDimensions(bytes: bytes)
        case "image/gif":
            return extractGifDimensions(bytes: bytes)
        default:
            return nil
        }
    }

    private func extractPngDimensions(bytes: [UInt8]) -> (width: Int, height: Int)? {
        guard bytes.count >= 24, bytes[0] == 0x89, bytes[1] == 0x50 else { return nil }
        let width = Int(UInt32(bytes[16]) << 24 | UInt32(bytes[17]) << 16 | UInt32(bytes[18]) << 8 | UInt32(bytes[19]))
        let height = Int(UInt32(bytes[20]) << 24 | UInt32(bytes[21]) << 16 | UInt32(bytes[22]) << 8 | UInt32(bytes[23]))
        return (width, height)
    }

    private func extractJpegDimensions(bytes: [UInt8]) -> (width: Int, height: Int)? {
        var offset = 2
        while offset + 8 < bytes.count {
            guard bytes[offset] == 0xFF else { offset += 1; continue }
            let marker = bytes[offset + 1]
            if marker == 0xC0 || marker == 0xC2 {
                let height = Int(UInt16(bytes[offset + 5]) << 8 | UInt16(bytes[offset + 6]))
                let width = Int(UInt16(bytes[offset + 7]) << 8 | UInt16(bytes[offset + 8]))
                return (width, height)
            }
            let segLen = Int(UInt16(bytes[offset + 2]) << 8 | UInt16(bytes[offset + 3]))
            offset += 2 + segLen
        }
        return nil
    }

    private func extractGifDimensions(bytes: [UInt8]) -> (width: Int, height: Int)? {
        guard bytes.count >= 10 else { return nil }
        let width = Int(UInt16(bytes[6]) | UInt16(bytes[7]) << 8)
        let height = Int(UInt16(bytes[8]) | UInt16(bytes[9]) << 8)
        return (width, height)
    }

    // MARK: - Utilities

    private func formatFileSize(bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1_048_576 { return String(format: "%.1f KB", Double(bytes) / 1024.0) }
        if bytes < 1_073_741_824 { return String(format: "%.1f MB", Double(bytes) / 1_048_576.0) }
        return String(format: "%.1f GB", Double(bytes) / 1_073_741_824.0)
    }
}
