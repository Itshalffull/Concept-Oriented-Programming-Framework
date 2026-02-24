// Data Integration Kit - Email Forward Capture Provider
// Parses forwarded email via RFC 2822 headers and MIME multipart decoding

import Foundation

public final class EmailForwardCaptureProvider {

    private struct EmailHeaders {
        var from: String = ""
        var to: String = ""
        var subject: String = "(No Subject)"
        var date: String = ""
        var messageId: String = ""
        var contentType: String = "text/plain"
        var boundary: String?
        var transferEncoding: String?
    }

    private struct MimePart {
        var contentType: String
        var encoding: String?
        var body: String
        var filename: String?
    }

    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let rawEmail = input.email, !rawEmail.isEmpty else {
            throw CaptureError.parseError("email_forward capture requires email content")
        }

        let (headerSection, bodySection) = splitHeadersBody(raw: rawEmail)
        let headers = parseHeaders(raw: headerSection)

        var textContent = ""
        var htmlContent = ""
        var attachments: [MimePart] = []

        if let boundary = headers.boundary {
            let parts = parseMultipart(body: bodySection, boundary: boundary)
            for part in parts {
                if part.filename != nil {
                    attachments.append(part)
                } else if part.contentType == "text/plain" && textContent.isEmpty {
                    textContent = part.body
                } else if part.contentType == "text/html" && htmlContent.isEmpty {
                    htmlContent = part.body
                }
            }
        } else {
            textContent = decodeBody(body: bodySection, encoding: headers.transferEncoding)
        }

        let preferHtml = config.options?["preferHtml"] as? Bool ?? false
        let primary = preferHtml && !htmlContent.isEmpty ? htmlContent : (textContent.isEmpty ? htmlContent : textContent)
        let forwardChain = extractForwardChain(body: primary)

        var contentParts = [
            "Subject: \(headers.subject)",
            "From: \(headers.from)",
            "To: \(headers.to)",
            "Date: \(headers.date)"
        ]
        if !headers.messageId.isEmpty {
            contentParts.append("Message-ID: \(headers.messageId)")
        }
        if !attachments.isEmpty {
            let names = attachments.compactMap { $0.filename }.joined(separator: ", ")
            contentParts.append("Attachments: \(names)")
        }
        contentParts.append("---")
        contentParts.append(primary)

        var tags = ["email"]
        tags.append(forwardChain.count > 1 ? "forwarded" : "direct")
        tags.append(attachments.isEmpty ? "no-attachments" : "has-attachments")

        return CaptureItem(
            content: contentParts.joined(separator: "\n"),
            sourceMetadata: SourceMetadata(
                title: headers.subject,
                url: nil,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: "message/rfc822",
                author: headers.from,
                tags: tags,
                source: "email_forward"
            ),
            rawData: (config.options?["includeRaw"] as? Bool == true)
                ? ["headers": headers, "forwardChain": forwardChain] as [String: Any]
                : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let email = input.email else { return false }
        return !email.isEmpty
    }

    // MARK: - RFC 2822 Header Parsing

    private func splitHeadersBody(raw: String) -> (String, String) {
        if let range = raw.range(of: "\n\n") {
            return (String(raw[raw.startIndex..<range.lowerBound]),
                    String(raw[range.upperBound...]).trimmingCharacters(in: .whitespaces))
        }
        if let range = raw.range(of: "\r\n\r\n") {
            return (String(raw[raw.startIndex..<range.lowerBound]),
                    String(raw[range.upperBound...]).trimmingCharacters(in: .whitespaces))
        }
        return (raw, "")
    }

    private func parseHeaders(raw: String) -> EmailHeaders {
        // Unfold continuation lines
        let unfolded = raw.replacingOccurrences(of: "\\r?\\n[ \\t]+", with: " ", options: .regularExpression)
        var headerMap: [String: String] = [:]

        for line in unfolded.components(separatedBy: .newlines) {
            guard let colonIndex = line.firstIndex(of: ":") else { continue }
            let name = line[line.startIndex..<colonIndex].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colonIndex)...].trimmingCharacters(in: .whitespaces)
            headerMap[name] = String(value)
        }

        let ct = headerMap["content-type"] ?? "text/plain"
        var boundary: String?
        if let regex = try? NSRegularExpression(pattern: #"(?i)boundary=["']?([^"';\s]+)["']?"#),
           let match = regex.firstMatch(in: ct, range: NSRange(ct.startIndex..., in: ct)),
           let range = Range(match.range(at: 1), in: ct) {
            boundary = String(ct[range])
        }

        return EmailHeaders(
            from: headerMap["from"] ?? "",
            to: headerMap["to"] ?? "",
            subject: headerMap["subject"] ?? "(No Subject)",
            date: headerMap["date"] ?? "",
            messageId: headerMap["message-id"] ?? "",
            contentType: ct,
            boundary: boundary,
            transferEncoding: headerMap["content-transfer-encoding"]
        )
    }

    // MARK: - MIME Multipart Parsing

    private func parseMultipart(body: String, boundary: String) -> [MimePart] {
        let delimiter = "--\(boundary)"
        let segments = body.components(separatedBy: delimiter)
        var parts: [MimePart] = []

        for segment in segments {
            let trimmed = segment.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed == "--" { continue }

            let headerEnd: String.Index
            if let range = trimmed.range(of: "\n\n") {
                headerEnd = range.lowerBound
            } else if let range = trimmed.range(of: "\r\n\r\n") {
                headerEnd = range.lowerBound
            } else {
                continue
            }

            let headerSection = String(trimmed[trimmed.startIndex..<headerEnd])
            let bodyStart = trimmed.index(headerEnd, offsetBy: 2, limitedBy: trimmed.endIndex) ?? headerEnd
            let bodySection = String(trimmed[bodyStart...]).trimmingCharacters(in: .whitespaces)

            var partHeaders: [String: String] = [:]
            let unfolded = headerSection.replacingOccurrences(of: "\\r?\\n[ \\t]+", with: " ", options: .regularExpression)
            for line in unfolded.components(separatedBy: .newlines) {
                guard let colonIndex = line.firstIndex(of: ":") else { continue }
                let name = line[line.startIndex..<colonIndex].trimmingCharacters(in: .whitespaces).lowercased()
                let value = line[line.index(after: colonIndex)...].trimmingCharacters(in: .whitespaces)
                partHeaders[name] = String(value)
            }

            let ct = partHeaders["content-type"]?.components(separatedBy: ";").first?
                .trimmingCharacters(in: .whitespaces) ?? "text/plain"
            let encoding = partHeaders["content-transfer-encoding"]
            let disposition = partHeaders["content-disposition"] ?? ""

            var filename: String?
            if let regex = try? NSRegularExpression(pattern: #"(?i)filename=["']?([^"';\s]+)["']?"#),
               let match = regex.firstMatch(in: disposition, range: NSRange(disposition.startIndex..., in: disposition)),
               let range = Range(match.range(at: 1), in: disposition) {
                filename = String(disposition[range])
            }

            parts.append(MimePart(
                contentType: ct,
                encoding: encoding,
                body: decodeBody(body: bodySection, encoding: encoding),
                filename: filename
            ))
        }
        return parts
    }

    // MARK: - Content Decoding

    private func decodeBody(body: String, encoding: String?) -> String {
        guard let enc = encoding?.lowercased() else { return body }
        switch enc {
        case "quoted-printable":
            return decodeQuotedPrintable(body)
        case "base64":
            return decodeBase64Content(body)
        default:
            return body
        }
    }

    private func decodeQuotedPrintable(_ input: String) -> String {
        var result = input.replacingOccurrences(of: "=\r\n", with: "")
            .replacingOccurrences(of: "=\n", with: "")
        guard let regex = try? NSRegularExpression(pattern: "=([0-9A-Fa-f]{2})") else { return result }
        let nsRange = NSRange(result.startIndex..., in: result)
        let matches = regex.matches(in: result, range: nsRange).reversed()
        for match in matches {
            guard let fullRange = Range(match.range, in: result),
                  let hexRange = Range(match.range(at: 1), in: result),
                  let byte = UInt8(result[hexRange], radix: 16) else { continue }
            result.replaceSubrange(fullRange, with: String(UnicodeScalar(byte)))
        }
        return result
    }

    private func decodeBase64Content(_ input: String) -> String {
        let cleaned = input.components(separatedBy: .whitespacesAndNewlines).joined()
        guard let data = Data(base64Encoded: cleaned),
              let decoded = String(data: data, encoding: .utf8) else { return input }
        return decoded
    }

    // MARK: - Forward Chain Detection

    private func extractForwardChain(body: String) -> [String] {
        guard let regex = try? NSRegularExpression(
            pattern: "[-]+\\s*(?:Forwarded|Original)\\s+[Mm]essage\\s*[-]+"
        ) else { return [body] }
        let nsRange = NSRange(body.startIndex..., in: body)
        let segments = regex.splitString(body, range: nsRange)
        return segments.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

// Helper extension for regex splitting
private extension NSRegularExpression {
    func splitString(_ string: String, range: NSRange) -> [String] {
        let matches = self.matches(in: string, range: range)
        var lastEnd = string.startIndex
        var results: [String] = []
        for match in matches {
            guard let matchRange = Range(match.range, in: string) else { continue }
            results.append(String(string[lastEnd..<matchRange.lowerBound]))
            lastEnd = matchRange.upperBound
        }
        results.append(String(string[lastEnd...]))
        return results
    }
}
