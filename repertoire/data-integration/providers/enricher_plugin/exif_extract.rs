// Clef Data Integration Kit - EXIF metadata extraction enricher provider
// Reads EXIF IFD entries from JPEG/TIFF bytes: parses APP1 marker, reads IFD tags
// for camera (0x010F), lens, GPS (IFD 0x8825), datetime (0x9003), dimensions.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "exif_extract";
pub const PLUGIN_TYPE: &str = "enricher_plugin";

#[derive(Debug, Clone)]
pub struct ContentItem {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnricherConfig {
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub threshold: Option<f64>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnrichmentResult {
    pub fields: HashMap<String, serde_json::Value>,
    pub confidence: f64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SchemaRef {
    pub name: String,
    pub fields: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct CostEstimate {
    pub tokens: Option<u64>,
    pub api_calls: Option<u64>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug)]
pub enum EnricherError {
    ParseError(String),
}

fn tag_name(tag: u16) -> Option<&'static str> {
    match tag {
        0x010F => Some("Make"),
        0x0110 => Some("Model"),
        0x0112 => Some("Orientation"),
        0x011A => Some("XResolution"),
        0x011B => Some("YResolution"),
        0x0132 => Some("DateTime"),
        0x8769 => Some("ExifIFDPointer"),
        0x8825 => Some("GPSInfoIFDPointer"),
        0x9003 => Some("DateTimeOriginal"),
        0x9004 => Some("DateTimeDigitized"),
        0x920A => Some("FocalLength"),
        0xA405 => Some("FocalLengthIn35mmFilm"),
        0x829A => Some("ExposureTime"),
        0x829D => Some("FNumber"),
        0x8827 => Some("ISOSpeedRatings"),
        0xA002 => Some("ExifImageWidth"),
        0xA003 => Some("ExifImageHeight"),
        0xA434 => Some("LensModel"),
        0xA433 => Some("LensMake"),
        _ => None,
    }
}

fn gps_tag_name(tag: u16) -> Option<&'static str> {
    match tag {
        0x0001 => Some("GPSLatitudeRef"),
        0x0002 => Some("GPSLatitude"),
        0x0003 => Some("GPSLongitudeRef"),
        0x0004 => Some("GPSLongitude"),
        0x0005 => Some("GPSAltitudeRef"),
        0x0006 => Some("GPSAltitude"),
        _ => None,
    }
}

struct ExifReader {
    data: Vec<u8>,
    little_endian: bool,
    tiff_offset: usize,
}

impl ExifReader {
    fn new(data: Vec<u8>) -> Self {
        Self { data, little_endian: false, tiff_offset: 0 }
    }

    fn read_u16(&self, offset: usize) -> u16 {
        if offset + 1 >= self.data.len() { return 0; }
        if self.little_endian {
            u16::from_le_bytes([self.data[offset], self.data[offset + 1]])
        } else {
            u16::from_be_bytes([self.data[offset], self.data[offset + 1]])
        }
    }

    fn read_u32(&self, offset: usize) -> u32 {
        if offset + 3 >= self.data.len() { return 0; }
        let bytes = [self.data[offset], self.data[offset+1], self.data[offset+2], self.data[offset+3]];
        if self.little_endian { u32::from_le_bytes(bytes) } else { u32::from_be_bytes(bytes) }
    }

    fn read_rational(&self, offset: usize) -> f64 {
        let num = self.read_u32(offset) as f64;
        let den = self.read_u32(offset + 4) as f64;
        if den != 0.0 { num / den } else { 0.0 }
    }

    fn read_string(&self, offset: usize, length: usize) -> String {
        let end = (offset + length).min(self.data.len());
        let bytes = &self.data[offset..end];
        let null_pos = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        String::from_utf8_lossy(&bytes[..null_pos]).to_string()
    }

    fn parse(&mut self) -> HashMap<String, serde_json::Value> {
        let mut result = HashMap::new();
        let mut offset = 0usize;

        // Find JPEG APP1 marker
        if self.data.len() > 2 && self.data[0] == 0xFF && self.data[1] == 0xD8 {
            offset = 2;
            while offset < self.data.len().saturating_sub(1) {
                if self.data[offset] == 0xFF && self.data[offset + 1] == 0xE1 {
                    offset += 4; // Skip marker + length
                    break;
                }
                if self.data[offset] == 0xFF && offset + 3 < self.data.len() {
                    let seg_len = u16::from_be_bytes([self.data[offset+2], self.data[offset+3]]) as usize;
                    offset += 2 + seg_len;
                } else {
                    offset += 1;
                }
            }
        }

        // Verify "Exif\0\0" header
        if offset + 6 > self.data.len() { return result; }
        let header = self.read_string(offset, 4);
        if header != "Exif" { return result; }
        offset += 6;

        self.tiff_offset = offset;

        // Read byte order
        if offset + 1 >= self.data.len() { return result; }
        let byte_order = u16::from_be_bytes([self.data[offset], self.data[offset + 1]]);
        self.little_endian = byte_order == 0x4949;

        // Verify TIFF magic (42)
        let magic = self.read_u16(offset + 2);
        if magic != 42 { return result; }

        // Read first IFD offset
        let ifd0_offset = self.read_u32(offset + 4) as usize;
        let ifd0_tags = self.parse_ifd(self.tiff_offset + ifd0_offset);

        let mut exif_ifd_ptr: Option<usize> = None;
        let mut gps_ifd_ptr: Option<usize> = None;

        for (tag, value) in &ifd0_tags {
            if *tag == 0x8769 {
                if let serde_json::Value::Number(n) = value {
                    exif_ifd_ptr = n.as_u64().map(|v| v as usize);
                }
            } else if *tag == 0x8825 {
                if let serde_json::Value::Number(n) = value {
                    gps_ifd_ptr = n.as_u64().map(|v| v as usize);
                }
            }
            if let Some(name) = tag_name(*tag) {
                result.insert(name.to_string(), value.clone());
            }
        }

        // Parse Exif sub-IFD
        if let Some(ptr) = exif_ifd_ptr {
            let exif_tags = self.parse_ifd(self.tiff_offset + ptr);
            for (tag, value) in &exif_tags {
                if let Some(name) = tag_name(*tag) {
                    result.insert(name.to_string(), value.clone());
                }
            }
        }

        // Parse GPS IFD
        if let Some(ptr) = gps_ifd_ptr {
            let gps_tags = self.parse_ifd(self.tiff_offset + ptr);
            let mut gps_data: HashMap<String, serde_json::Value> = HashMap::new();
            for (tag, value) in &gps_tags {
                if let Some(name) = gps_tag_name(*tag) {
                    gps_data.insert(name.to_string(), value.clone());
                }
            }

            // Convert GPS to decimal degrees
            if let (Some(lat_arr), Some(lon_arr)) = (gps_data.get("GPSLatitude"), gps_data.get("GPSLongitude")) {
                let lat_ref = gps_data.get("GPSLatitudeRef")
                    .and_then(|v| v.as_str()).unwrap_or("N");
                let lon_ref = gps_data.get("GPSLongitudeRef")
                    .and_then(|v| v.as_str()).unwrap_or("E");

                if let (Some(lat_vals), Some(lon_vals)) = (lat_arr.as_array(), lon_arr.as_array()) {
                    let lat = gps_to_decimal(lat_vals, lat_ref);
                    let lon = gps_to_decimal(lon_vals, lon_ref);
                    result.insert("GPSLatitude".to_string(), serde_json::json!(lat));
                    result.insert("GPSLongitude".to_string(), serde_json::json!(lon));
                }
                if let Some(alt) = gps_data.get("GPSAltitude") {
                    result.insert("GPSAltitude".to_string(), alt.clone());
                }
            }
        }

        result
    }

    fn parse_ifd(&self, offset: usize) -> Vec<(u16, serde_json::Value)> {
        let mut tags = Vec::new();
        if offset + 2 > self.data.len() { return tags; }

        let entry_count = self.read_u16(offset) as usize;
        let mut pos = offset + 2;

        for _ in 0..entry_count {
            if pos + 12 > self.data.len() { break; }

            let tag = self.read_u16(pos);
            let data_type = self.read_u16(pos + 2);
            let count = self.read_u32(pos + 4) as usize;
            let value_offset = pos + 8;

            let value = self.read_tag_value(data_type, count, value_offset);
            tags.push((tag, value));
            pos += 12;
        }
        tags
    }

    fn read_tag_value(&self, data_type: u16, count: usize, value_offset: usize) -> serde_json::Value {
        let type_size = match data_type { 1 | 2 => 1, 3 => 2, 4 => 4, 5 => 8, _ => 1 };
        let total_bytes = type_size * count;
        let data_offset = if total_bytes > 4 {
            self.tiff_offset + self.read_u32(value_offset) as usize
        } else {
            value_offset
        };

        match data_type {
            1 => { // BYTE
                if count == 1 { serde_json::json!(self.data.get(data_offset).copied().unwrap_or(0)) }
                else { serde_json::json!(self.data[data_offset..data_offset.min(self.data.len())].iter().take(count).collect::<Vec<_>>()) }
            }
            2 => serde_json::json!(self.read_string(data_offset, count)), // ASCII
            3 => { // SHORT
                if count == 1 { serde_json::json!(self.read_u16(data_offset)) }
                else { serde_json::json!((0..count).map(|i| self.read_u16(data_offset + i * 2)).collect::<Vec<_>>()) }
            }
            4 => { // LONG
                if count == 1 { serde_json::json!(self.read_u32(data_offset)) }
                else { serde_json::json!((0..count).map(|i| self.read_u32(data_offset + i * 4)).collect::<Vec<_>>()) }
            }
            5 => { // RATIONAL
                if count == 1 { serde_json::json!(self.read_rational(data_offset)) }
                else { serde_json::json!((0..count).map(|i| self.read_rational(data_offset + i * 8)).collect::<Vec<f64>>()) }
            }
            _ => serde_json::json!(self.read_u32(value_offset)),
        }
    }
}

fn gps_to_decimal(dms: &[serde_json::Value], reference: &str) -> f64 {
    if dms.len() < 3 { return 0.0; }
    let d = dms[0].as_f64().unwrap_or(0.0);
    let m = dms[1].as_f64().unwrap_or(0.0);
    let s = dms[2].as_f64().unwrap_or(0.0);
    let mut decimal = d + m / 60.0 + s / 3600.0;
    if reference == "S" || reference == "W" { decimal = -decimal; }
    (decimal * 1_000_000.0).round() / 1_000_000.0
}

pub struct ExifExtractEnricherProvider;

impl ExifExtractEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        _config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let image_bytes = base64_decode_bytes(&item.content);
        let mut reader = ExifReader::new(image_bytes);
        let exif_data = reader.parse();

        let has_data = !exif_data.is_empty();
        let has_gps = exif_data.contains_key("GPSLatitude");
        let tag_count = exif_data.len();

        let camera = serde_json::json!({
            "make": exif_data.get("Make"),
            "model": exif_data.get("Model"),
            "lens": exif_data.get("LensModel"),
            "lensMake": exif_data.get("LensMake"),
        });
        let settings = serde_json::json!({
            "exposureTime": exif_data.get("ExposureTime"),
            "fNumber": exif_data.get("FNumber"),
            "iso": exif_data.get("ISOSpeedRatings"),
            "focalLength": exif_data.get("FocalLength"),
            "focalLength35mm": exif_data.get("FocalLengthIn35mmFilm"),
        });
        let datetime = serde_json::json!({
            "original": exif_data.get("DateTimeOriginal"),
            "digitized": exif_data.get("DateTimeDigitized"),
            "modified": exif_data.get("DateTime"),
        });
        let dimensions = serde_json::json!({
            "width": exif_data.get("ExifImageWidth"),
            "height": exif_data.get("ExifImageHeight"),
            "orientation": exif_data.get("Orientation"),
        });
        let gps = if has_gps {
            serde_json::json!({
                "latitude": exif_data.get("GPSLatitude"),
                "longitude": exif_data.get("GPSLongitude"),
                "altitude": exif_data.get("GPSAltitude"),
            })
        } else {
            serde_json::Value::Null
        };

        let mut fields = HashMap::new();
        fields.insert("exif".to_string(), serde_json::json!({
            "camera": camera, "settings": settings,
            "datetime": datetime, "dimensions": dimensions, "gps": gps,
        }));
        fields.insert("raw_tags".to_string(), serde_json::json!(exif_data));
        fields.insert("has_gps".to_string(), serde_json::json!(has_gps));
        fields.insert("tag_count".to_string(), serde_json::json!(tag_count));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("parsedTags".to_string(), serde_json::json!(tag_count));
        metadata.insert("method".to_string(), serde_json::json!("binary_ifd_parse"));

        Ok(EnrichmentResult {
            fields,
            confidence: if has_data { 0.95 } else { 0.1 },
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let image_schemas = ["image", "photo", "jpeg", "jpg", "tiff", "picture"];
        let name_lower = schema.name.to_lowercase();
        image_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, _item: &ContentItem) -> CostEstimate {
        CostEstimate { tokens: None, api_calls: Some(0), duration_ms: Some(5) }
    }
}

fn base64_decode_bytes(input: &str) -> Vec<u8> {
    let table = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = Vec::new();
    let chars: Vec<u8> = input.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    for chunk in chars.chunks(4) {
        let mut buf = [0u8; 4];
        let mut count = 0;
        for (i, &byte) in chunk.iter().enumerate() {
            if byte == b'=' { break; }
            if let Some(pos) = table.iter().position(|&c| c == byte) {
                buf[i] = pos as u8;
                count = i + 1;
            }
        }
        if count >= 2 { output.push((buf[0] << 2) | (buf[1] >> 4)); }
        if count >= 3 { output.push((buf[1] << 4) | (buf[2] >> 2)); }
        if count >= 4 { output.push((buf[2] << 6) | buf[3]); }
    }
    output
}
