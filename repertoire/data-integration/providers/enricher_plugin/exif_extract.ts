// COPF Data Integration Kit - EXIF metadata extraction enricher provider
// Reads EXIF IFD entries from JPEG/TIFF bytes: parses APP1 marker, reads IFD tags for
// camera, lens, GPS, datetime, dimensions.

export const PROVIDER_ID = 'exif_extract';
export const PLUGIN_TYPE = 'enricher_plugin';

export interface ContentItem {
  id: string;
  content: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface EnricherConfig {
  model?: string;
  apiKey?: string;
  threshold?: number;
  options?: Record<string, unknown>;
}

export interface EnrichmentResult {
  fields: Record<string, unknown>;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SchemaRef {
  name: string;
  fields?: string[];
}

export interface CostEstimate {
  tokens?: number;
  apiCalls?: number;
  durationMs?: number;
}

// EXIF IFD tag constants
const EXIF_TAGS: Record<number, string> = {
  0x010F: 'Make',             // Camera manufacturer
  0x0110: 'Model',            // Camera model
  0x0112: 'Orientation',      // Image orientation
  0x011A: 'XResolution',      // Horizontal resolution
  0x011B: 'YResolution',      // Vertical resolution
  0x0132: 'DateTime',         // File change date
  0x8769: 'ExifIFDPointer',   // Pointer to Exif sub-IFD
  0x8825: 'GPSInfoIFDPointer', // Pointer to GPS IFD
  0x9003: 'DateTimeOriginal', // Original datetime
  0x9004: 'DateTimeDigitized',
  0x920A: 'FocalLength',
  0xA405: 'FocalLengthIn35mmFilm',
  0x829A: 'ExposureTime',
  0x829D: 'FNumber',
  0x8827: 'ISOSpeedRatings',
  0xA001: 'ColorSpace',
  0xA002: 'ExifImageWidth',
  0xA003: 'ExifImageHeight',
  0xA434: 'LensModel',
  0xA433: 'LensMake',
};

const GPS_TAGS: Record<number, string> = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
};

class ExifReader {
  private buffer: Buffer;
  private littleEndian: boolean = false;
  private tiffOffset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readUint16(offset: number): number {
    return this.littleEndian
      ? this.buffer.readUInt16LE(offset)
      : this.buffer.readUInt16BE(offset);
  }

  readUint32(offset: number): number {
    return this.littleEndian
      ? this.buffer.readUInt32LE(offset)
      : this.buffer.readUInt32BE(offset);
  }

  readRational(offset: number): number {
    const numerator = this.readUint32(offset);
    const denominator = this.readUint32(offset + 4);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  readString(offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const code = this.buffer[offset + i];
      if (code === 0) break;
      result += String.fromCharCode(code);
    }
    return result;
  }

  parse(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Find JPEG APP1 marker (0xFFE1) containing EXIF data
    let offset = 0;
    if (this.buffer[0] === 0xFF && this.buffer[1] === 0xD8) {
      // JPEG file - scan for APP1 marker
      offset = 2;
      while (offset < this.buffer.length - 1) {
        if (this.buffer[offset] === 0xFF && this.buffer[offset + 1] === 0xE1) {
          offset += 4; // Skip marker + length
          break;
        }
        if (this.buffer[offset] === 0xFF) {
          const segmentLength = this.buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        } else {
          offset++;
        }
      }
    }

    // Verify "Exif\0\0" header
    const exifHeader = this.readString(offset, 4);
    if (exifHeader !== 'Exif') return result;
    offset += 6; // Skip "Exif\0\0"

    this.tiffOffset = offset;

    // Read TIFF header to determine byte order
    const byteOrder = this.buffer.readUInt16BE(offset);
    this.littleEndian = byteOrder === 0x4949; // 'II' = Intel = little-endian

    // Verify TIFF magic number (42)
    const magic = this.readUint16(offset + 2);
    if (magic !== 42) return result;

    // Read offset to first IFD
    const ifd0Offset = this.readUint32(offset + 4);

    // Parse IFD0 (main image IFD)
    const ifd0Tags = this.parseIFD(this.tiffOffset + ifd0Offset);

    for (const [tag, value] of ifd0Tags) {
      const tagName = EXIF_TAGS[tag];
      if (tagName) {
        result[tagName] = value;
      }
    }

    // Follow ExifIFDPointer to sub-IFD
    const exifIfdPtr = ifd0Tags.get(0x8769);
    if (typeof exifIfdPtr === 'number') {
      const exifTags = this.parseIFD(this.tiffOffset + exifIfdPtr);
      for (const [tag, value] of exifTags) {
        const tagName = EXIF_TAGS[tag];
        if (tagName) result[tagName] = value;
      }
    }

    // Follow GPSInfoIFDPointer
    const gpsIfdPtr = ifd0Tags.get(0x8825);
    if (typeof gpsIfdPtr === 'number') {
      const gpsTags = this.parseIFD(this.tiffOffset + gpsIfdPtr);
      const gps: Record<string, unknown> = {};
      for (const [tag, value] of gpsTags) {
        const tagName = GPS_TAGS[tag];
        if (tagName) gps[tagName] = value;
      }

      // Convert GPS coordinates to decimal degrees
      if (gps.GPSLatitude && gps.GPSLongitude) {
        const lat = this.gpsToDecimal(gps.GPSLatitude as number[], gps.GPSLatitudeRef as string);
        const lon = this.gpsToDecimal(gps.GPSLongitude as number[], gps.GPSLongitudeRef as string);
        result['GPSLatitude'] = lat;
        result['GPSLongitude'] = lon;
        if (gps.GPSAltitude) result['GPSAltitude'] = gps.GPSAltitude;
      }
    }

    return result;
  }

  private parseIFD(offset: number): Map<number, unknown> {
    const tags = new Map<number, unknown>();
    if (offset >= this.buffer.length - 2) return tags;

    const entryCount = this.readUint16(offset);
    let pos = offset + 2;

    for (let i = 0; i < entryCount; i++) {
      if (pos + 12 > this.buffer.length) break;

      const tag = this.readUint16(pos);
      const type = this.readUint16(pos + 2);
      const count = this.readUint32(pos + 4);
      const valueOffset = pos + 8;

      const value = this.readTagValue(type, count, valueOffset);
      tags.set(tag, value);

      pos += 12;
    }

    return tags;
  }

  private readTagValue(type: number, count: number, valueOffset: number): unknown {
    const totalBytes = this.typeSize(type) * count;
    const dataOffset = totalBytes > 4
      ? this.tiffOffset + this.readUint32(valueOffset)
      : valueOffset;

    switch (type) {
      case 1: // BYTE
        return count === 1 ? this.buffer[dataOffset] : Array.from(this.buffer.slice(dataOffset, dataOffset + count));
      case 2: // ASCII
        return this.readString(dataOffset, count);
      case 3: // SHORT
        return count === 1 ? this.readUint16(dataOffset) : Array.from({ length: count }, (_, i) => this.readUint16(dataOffset + i * 2));
      case 4: // LONG
        return count === 1 ? this.readUint32(dataOffset) : Array.from({ length: count }, (_, i) => this.readUint32(dataOffset + i * 4));
      case 5: // RATIONAL
        if (count === 1) return this.readRational(dataOffset);
        return Array.from({ length: count }, (_, i) => this.readRational(dataOffset + i * 8));
      default:
        return this.readUint32(valueOffset);
    }
  }

  private typeSize(type: number): number {
    switch (type) {
      case 1: case 2: return 1;
      case 3: return 2;
      case 4: return 4;
      case 5: return 8;
      default: return 1;
    }
  }

  private gpsToDecimal(dms: number[], ref: string): number {
    if (dms.length < 3) return 0;
    let decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return Math.round(decimal * 1000000) / 1000000;
  }
}

export class ExifExtractEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const imageBuffer = Buffer.from(item.content, 'base64');
    const reader = new ExifReader(imageBuffer);
    const exifData = reader.parse();

    const hasData = Object.keys(exifData).length > 0;

    // Structure the output into logical groups
    const structured: Record<string, unknown> = {
      camera: {
        make: exifData.Make ?? null,
        model: exifData.Model ?? null,
        lens: exifData.LensModel ?? null,
        lensMake: exifData.LensMake ?? null,
      },
      settings: {
        exposureTime: exifData.ExposureTime ?? null,
        fNumber: exifData.FNumber ?? null,
        iso: exifData.ISOSpeedRatings ?? null,
        focalLength: exifData.FocalLength ?? null,
        focalLength35mm: exifData.FocalLengthIn35mmFilm ?? null,
      },
      datetime: {
        original: exifData.DateTimeOriginal ?? null,
        digitized: exifData.DateTimeDigitized ?? null,
        modified: exifData.DateTime ?? null,
      },
      dimensions: {
        width: exifData.ExifImageWidth ?? null,
        height: exifData.ExifImageHeight ?? null,
        orientation: exifData.Orientation ?? null,
      },
      gps: exifData.GPSLatitude != null ? {
        latitude: exifData.GPSLatitude,
        longitude: exifData.GPSLongitude,
        altitude: exifData.GPSAltitude ?? null,
      } : null,
    };

    return {
      fields: {
        exif: structured,
        raw_tags: exifData,
        has_gps: exifData.GPSLatitude != null,
        tag_count: Object.keys(exifData).length,
      },
      confidence: hasData ? 0.95 : 0.1,
      metadata: {
        provider: PROVIDER_ID,
        parsedTags: Object.keys(exifData).length,
        method: 'binary_ifd_parse',
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const imageSchemas = ['image', 'photo', 'jpeg', 'jpg', 'tiff', 'picture'];
    return imageSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    // EXIF parsing is fast - only reads headers, not pixel data
    return { durationMs: 5, apiCalls: 0 };
  }
}

export default ExifExtractEnricherProvider;
