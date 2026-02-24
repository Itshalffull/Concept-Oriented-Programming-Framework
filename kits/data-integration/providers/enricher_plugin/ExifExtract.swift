// COPF Data Integration Kit - EXIF metadata extraction enricher provider
// Reads EXIF IFD entries from JPEG/TIFF bytes: parses APP1 marker, reads IFD tags
// for camera (0x010F), lens, GPS (IFD 0x8825), datetime (0x9003), dimensions.

import Foundation

public let ExifExtractProviderID = "exif_extract"
public let ExifExtractPluginType = "enricher_plugin"

private let exifTagNames: [UInt16: String] = [
    0x010F: "Make", 0x0110: "Model", 0x0112: "Orientation",
    0x011A: "XResolution", 0x011B: "YResolution", 0x0132: "DateTime",
    0x8769: "ExifIFDPointer", 0x8825: "GPSInfoIFDPointer",
    0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized",
    0x920A: "FocalLength", 0xA405: "FocalLengthIn35mmFilm",
    0x829A: "ExposureTime", 0x829D: "FNumber", 0x8827: "ISOSpeedRatings",
    0xA002: "ExifImageWidth", 0xA003: "ExifImageHeight",
    0xA434: "LensModel", 0xA433: "LensMake"
]

private let gpsTagNames: [UInt16: String] = [
    0x0001: "GPSLatitudeRef", 0x0002: "GPSLatitude",
    0x0003: "GPSLongitudeRef", 0x0004: "GPSLongitude",
    0x0005: "GPSAltitudeRef", 0x0006: "GPSAltitude"
]

private class ExifParser {
    let data: Data
    var littleEndian: Bool = false
    var tiffOffset: Int = 0

    init(data: Data) {
        self.data = data
    }

    func readUInt16(_ offset: Int) -> UInt16 {
        guard offset + 1 < data.count else { return 0 }
        if littleEndian {
            return UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
        }
        return (UInt16(data[offset]) << 8) | UInt16(data[offset + 1])
    }

    func readUInt32(_ offset: Int) -> UInt32 {
        guard offset + 3 < data.count else { return 0 }
        if littleEndian {
            return UInt32(data[offset]) | (UInt32(data[offset+1]) << 8) |
                   (UInt32(data[offset+2]) << 16) | (UInt32(data[offset+3]) << 24)
        }
        return (UInt32(data[offset]) << 24) | (UInt32(data[offset+1]) << 16) |
               (UInt32(data[offset+2]) << 8) | UInt32(data[offset+3])
    }

    func readRational(_ offset: Int) -> Double {
        let num = Double(readUInt32(offset))
        let den = Double(readUInt32(offset + 4))
        return den != 0 ? num / den : 0
    }

    func readString(_ offset: Int, length: Int) -> String {
        let end = min(offset + length, data.count)
        let bytes = data[offset..<end]
        if let nullPos = bytes.firstIndex(of: 0) {
            return String(bytes: data[offset..<nullPos], encoding: .ascii) ?? ""
        }
        return String(bytes: bytes, encoding: .ascii) ?? ""
    }

    func parse() -> [String: Any] {
        var result: [String: Any] = [:]
        var offset = 0

        // Find JPEG APP1 marker
        if data.count > 2 && data[0] == 0xFF && data[1] == 0xD8 {
            offset = 2
            while offset < data.count - 1 {
                if data[offset] == 0xFF && data[offset + 1] == 0xE1 {
                    offset += 4
                    break
                }
                if data[offset] == 0xFF && offset + 3 < data.count {
                    let segLen = Int((UInt16(data[offset+2]) << 8) | UInt16(data[offset+3]))
                    offset += 2 + segLen
                } else {
                    offset += 1
                }
            }
        }

        guard offset + 6 < data.count else { return result }
        let header = readString(offset, length: 4)
        guard header == "Exif" else { return result }
        offset += 6

        tiffOffset = offset

        guard offset + 8 < data.count else { return result }
        let byteOrder = (UInt16(data[offset]) << 8) | UInt16(data[offset + 1])
        littleEndian = byteOrder == 0x4949

        let magic = readUInt16(offset + 2)
        guard magic == 42 else { return result }

        let ifd0Offset = Int(readUInt32(offset + 4))
        let ifd0Tags = parseIFD(tiffOffset + ifd0Offset)

        var exifIFDPtr: Int?
        var gpsIFDPtr: Int?

        for (tag, value) in ifd0Tags {
            if tag == 0x8769, let v = value as? Int { exifIFDPtr = v }
            if tag == 0x8825, let v = value as? Int { gpsIFDPtr = v }
            if let name = exifTagNames[tag] {
                result[name] = value
            }
        }

        // Parse Exif sub-IFD
        if let ptr = exifIFDPtr {
            let exifTags = parseIFD(tiffOffset + ptr)
            for (tag, value) in exifTags {
                if let name = exifTagNames[tag] { result[name] = value }
            }
        }

        // Parse GPS IFD
        if let ptr = gpsIFDPtr {
            let gpsTags = parseIFD(tiffOffset + ptr)
            var gpsData: [String: Any] = [:]
            for (tag, value) in gpsTags {
                if let name = gpsTagNames[tag] { gpsData[name] = value }
            }

            if let latArr = gpsData["GPSLatitude"] as? [Double],
               let lonArr = gpsData["GPSLongitude"] as? [Double] {
                let latRef = (gpsData["GPSLatitudeRef"] as? String) ?? "N"
                let lonRef = (gpsData["GPSLongitudeRef"] as? String) ?? "E"
                result["GPSLatitude"] = gpsToDecimal(latArr, ref: latRef)
                result["GPSLongitude"] = gpsToDecimal(lonArr, ref: lonRef)
                if let alt = gpsData["GPSAltitude"] { result["GPSAltitude"] = alt }
            }
        }

        return result
    }

    private func parseIFD(_ offset: Int) -> [(UInt16, Any)] {
        var tags: [(UInt16, Any)] = []
        guard offset + 2 < data.count else { return tags }

        let entryCount = Int(readUInt16(offset))
        var pos = offset + 2

        for _ in 0..<entryCount {
            guard pos + 12 <= data.count else { break }
            let tag = readUInt16(pos)
            let dataType = readUInt16(pos + 2)
            let count = Int(readUInt32(pos + 4))
            let valueOffset = pos + 8

            let value = readTagValue(dataType: dataType, count: count, valueOffset: valueOffset)
            tags.append((tag, value))
            pos += 12
        }
        return tags
    }

    private func readTagValue(dataType: UInt16, count: Int, valueOffset: Int) -> Any {
        let typeSize: Int
        switch dataType { case 1, 2: typeSize = 1; case 3: typeSize = 2; case 4: typeSize = 4; case 5: typeSize = 8; default: typeSize = 1 }
        let totalBytes = typeSize * count
        let dataOffset = totalBytes > 4 ? tiffOffset + Int(readUInt32(valueOffset)) : valueOffset

        switch dataType {
        case 1: // BYTE
            return count == 1 ? Int(data[dataOffset]) : Array(data[dataOffset..<min(dataOffset+count, data.count)]).map { Int($0) }
        case 2: // ASCII
            return readString(dataOffset, length: count)
        case 3: // SHORT
            if count == 1 { return Int(readUInt16(dataOffset)) }
            return (0..<count).map { Int(readUInt16(dataOffset + $0 * 2)) }
        case 4: // LONG
            if count == 1 { return Int(readUInt32(dataOffset)) }
            return (0..<count).map { Int(readUInt32(dataOffset + $0 * 4)) }
        case 5: // RATIONAL
            if count == 1 { return readRational(dataOffset) }
            return (0..<count).map { readRational(dataOffset + $0 * 8) }
        default:
            return Int(readUInt32(valueOffset))
        }
    }

    private func gpsToDecimal(_ dms: [Double], ref: String) -> Double {
        guard dms.count >= 3 else { return 0 }
        var decimal = dms[0] + dms[1] / 60.0 + dms[2] / 3600.0
        if ref == "S" || ref == "W" { decimal = -decimal }
        return (decimal * 1_000_000).rounded() / 1_000_000
    }
}

public final class ExifExtractEnricherProvider {
    public init() {}

    public func enrich(item: ContentItem, config: EnricherConfig) async throws -> EnrichmentResult {
        guard let imageData = Data(base64Encoded: item.content) else {
            throw EnricherError.parseError("Failed to decode base64 image data")
        }

        let parser = ExifParser(data: imageData)
        let exifData = parser.parse()
        let hasData = !exifData.isEmpty
        let hasGps = exifData["GPSLatitude"] != nil

        let structured: [String: Any] = [
            "camera": [
                "make": exifData["Make"] as Any,
                "model": exifData["Model"] as Any,
                "lens": exifData["LensModel"] as Any,
                "lensMake": exifData["LensMake"] as Any
            ],
            "settings": [
                "exposureTime": exifData["ExposureTime"] as Any,
                "fNumber": exifData["FNumber"] as Any,
                "iso": exifData["ISOSpeedRatings"] as Any,
                "focalLength": exifData["FocalLength"] as Any,
                "focalLength35mm": exifData["FocalLengthIn35mmFilm"] as Any
            ],
            "datetime": [
                "original": exifData["DateTimeOriginal"] as Any,
                "digitized": exifData["DateTimeDigitized"] as Any,
                "modified": exifData["DateTime"] as Any
            ],
            "dimensions": [
                "width": exifData["ExifImageWidth"] as Any,
                "height": exifData["ExifImageHeight"] as Any,
                "orientation": exifData["Orientation"] as Any
            ],
            "gps": hasGps ? [
                "latitude": exifData["GPSLatitude"] as Any,
                "longitude": exifData["GPSLongitude"] as Any,
                "altitude": exifData["GPSAltitude"] as Any
            ] as [String: Any] : nil as Any
        ]

        return EnrichmentResult(
            fields: [
                "exif": structured,
                "has_gps": hasGps,
                "tag_count": exifData.count
            ],
            confidence: hasData ? 0.95 : 0.1,
            metadata: [
                "provider": ExifExtractProviderID,
                "parsedTags": exifData.count,
                "method": "binary_ifd_parse"
            ]
        )
    }

    public func appliesTo(schema: SchemaRef) -> Bool {
        let imageSchemas = ["image", "photo", "jpeg", "jpg", "tiff", "picture"]
        let nameLower = schema.name.lowercased()
        return imageSchemas.contains { nameLower.contains($0) }
    }

    public func costEstimate(item: ContentItem) -> CostEstimate {
        return CostEstimate(tokens: nil, apiCalls: 0, durationMs: 5)
    }
}
