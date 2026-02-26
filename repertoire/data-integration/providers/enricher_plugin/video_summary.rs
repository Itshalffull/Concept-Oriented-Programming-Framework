// COPF Data Integration Kit - Video summarization enricher provider
// Extracts keyframes at intervals, generates transcript via whisper, combines for chapter markers.

use std::collections::HashMap;
use std::io::Write;
use std::process::Command;

pub const PROVIDER_ID: &str = "video_summary";
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct Chapter {
    pub title: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Keyframe {
    pub timestamp: f64,
    pub description: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscriptSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    IoError(std::io::Error),
    ProcessError(String),
    ParseError(String),
}

impl From<std::io::Error> for EnricherError {
    fn from(e: std::io::Error) -> Self {
        EnricherError::IoError(e)
    }
}

fn get_video_duration(video_path: &str) -> Result<f64, EnricherError> {
    let output = Command::new("ffprobe")
        .args(["-v", "quiet", "-print_format", "json", "-show_format", video_path])
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| EnricherError::ParseError(format!("ffprobe JSON parse error: {}", e)))?;

    json.pointer("/format/duration")
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .ok_or_else(|| EnricherError::ParseError("Could not read duration".to_string()))
}

fn extract_keyframes(
    video_path: &str,
    interval_sec: f64,
    output_dir: &str,
) -> Result<Vec<Keyframe>, EnricherError> {
    let vf_filter = format!("fps=1/{},select='gt(scene,0.3)+not(mod(n,1))'", interval_sec);
    let output_pattern = format!("{}/keyframe_%04d.jpg", output_dir);

    let result = Command::new("ffmpeg")
        .args(["-i", video_path, "-vf", &vf_filter, "-vsync", "vfr", "-q:v", "2", &output_pattern])
        .output()?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(EnricherError::ProcessError(format!("ffmpeg failed: {}", stderr)));
    }

    let mut keyframes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        let mut files: Vec<String> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|f| f.starts_with("keyframe_"))
            .collect();
        files.sort();

        for (idx, _) in files.iter().enumerate() {
            let ts = idx as f64 * interval_sec;
            keyframes.push(Keyframe {
                timestamp: ts,
                description: format!("Keyframe at {}", format_timestamp(ts)),
            });
        }
    }
    Ok(keyframes)
}

fn extract_audio_track(video_path: &str, output_path: &str) -> Result<(), EnricherError> {
    let result = Command::new("ffmpeg")
        .args(["-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", output_path])
        .output()?;

    if !result.status.success() {
        return Err(EnricherError::ProcessError("Audio extraction failed".to_string()));
    }
    Ok(())
}

fn transcribe_audio(audio_path: &str, language: &str) -> Result<Vec<TranscriptSegment>, EnricherError> {
    let tmp_dir = std::env::temp_dir();
    let result = Command::new("whisper")
        .args([
            audio_path, "--model", "base", "--language", language,
            "--output_format", "json", "--output_dir", tmp_dir.to_str().unwrap_or("/tmp"),
        ])
        .output()?;

    if !result.status.success() {
        return Ok(vec![]);
    }

    let stem = std::path::Path::new(audio_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let json_path = tmp_dir.join(format!("{}.json", stem));

    let content = match std::fs::read_to_string(&json_path) {
        Ok(c) => c,
        Err(_) => return Ok(vec![]),
    };
    let _ = std::fs::remove_file(&json_path);

    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| EnricherError::ParseError(format!("Whisper JSON error: {}", e)))?;

    let segments = json.get("segments")
        .and_then(|s| s.as_array())
        .map(|segs| {
            segs.iter().filter_map(|seg| {
                let text = seg.get("text").and_then(|t| t.as_str())?.trim().to_string();
                let start = seg.get("start").and_then(|s| s.as_f64()).unwrap_or(0.0);
                let end = seg.get("end").and_then(|e| e.as_f64()).unwrap_or(0.0);
                Some(TranscriptSegment { text, start, end })
            }).collect()
        })
        .unwrap_or_default();

    Ok(segments)
}

fn generate_chapters(
    segments: &[TranscriptSegment],
    chapter_interval: f64,
    total_duration: f64,
) -> Vec<Chapter> {
    let mut chapters = Vec::new();
    let mut chapter_start = 0.0;

    while chapter_start < total_duration {
        let chapter_end = (chapter_start + chapter_interval).min(total_duration);

        let chapter_segments: Vec<&TranscriptSegment> = segments.iter()
            .filter(|s| s.start >= chapter_start && s.start < chapter_end)
            .collect();

        let title = if !chapter_segments.is_empty() {
            let combined: String = chapter_segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");
            let first_sentence = combined.split(|c: char| c == '.' || c == '!' || c == '?')
                .find(|s| !s.trim().is_empty())
                .unwrap_or("");
            let trimmed = first_sentence.trim();
            if trimmed.len() > 80 { trimmed[..80].to_string() } else { trimmed.to_string() }
        } else {
            format!("Chapter at {}", format_timestamp(chapter_start))
        };

        chapters.push(Chapter { title, start: chapter_start, end: chapter_end });
        chapter_start = chapter_end;
    }
    chapters
}

fn generate_summary(segments: &[TranscriptSegment], counts: (usize, usize, usize)) -> (String, String, String) {
    let full_text: String = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");
    let sentences: Vec<&str> = full_text.split(|c: char| c == '.' || c == '!' || c == '?')
        .map(|s| s.trim())
        .filter(|s| s.split_whitespace().count() >= 3)
        .collect();

    // Score sentences by position and length
    let mut scored: Vec<(usize, f64, &str)> = sentences.iter().enumerate().map(|(idx, &sent)| {
        let mut score = 0.0;
        if idx == 0 { score += 3.0; }
        if idx == sentences.len().saturating_sub(1) { score += 2.0; }
        if (idx as f64) < sentences.len() as f64 * 0.2 { score += 1.0; }
        let wc = sent.split_whitespace().count();
        if wc >= 8 && wc <= 25 { score += 2.0; }
        (idx, score, sent)
    }).collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let pick = |n: usize| -> String {
        scored.iter().take(n).map(|(_, _, s)| *s).collect::<Vec<_>>().join(". ") + "."
    };

    (pick(counts.0), pick(counts.1), pick(counts.2))
}

fn format_timestamp(seconds: f64) -> String {
    let total_secs = seconds as u64;
    let h = total_secs / 3600;
    let m = (total_secs % 3600) / 60;
    let s = total_secs % 60;
    if h > 0 {
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        format!("{}:{:02}", m, s)
    }
}

pub struct VideoSummaryEnricherProvider;

impl VideoSummaryEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let chapter_interval = opts.and_then(|o| o.get("chapterInterval"))
            .and_then(|v| v.as_f64()).unwrap_or(300.0);
        let language = opts.and_then(|o| o.get("language"))
            .and_then(|v| v.as_str()).unwrap_or("en");
        let summary_short = opts.and_then(|o| o.get("summaryLengths"))
            .and_then(|v| v.get("short")).and_then(|v| v.as_u64()).unwrap_or(2) as usize;
        let summary_medium = opts.and_then(|o| o.get("summaryLengths"))
            .and_then(|v| v.get("medium")).and_then(|v| v.as_u64()).unwrap_or(5) as usize;
        let summary_long = opts.and_then(|o| o.get("summaryLengths"))
            .and_then(|v| v.get("long")).and_then(|v| v.as_u64()).unwrap_or(10) as usize;

        let tmp = std::env::temp_dir();
        let pid = std::process::id();
        let video_path = tmp.join(format!("copf_video_{}_{}.mp4", item.id, pid));
        let audio_path = tmp.join(format!("copf_audio_{}_{}.wav", item.id, pid));
        let keyframe_dir = tmp.join(format!("copf_keyframes_{}_{}", item.id, pid));
        std::fs::create_dir_all(&keyframe_dir)?;

        // Decode and write video
        let video_bytes = base64_decode_bytes(&item.content);
        std::fs::write(&video_path, &video_bytes)?;

        let result = (|| -> Result<EnrichmentResult, EnricherError> {
            let duration = get_video_duration(video_path.to_str().unwrap_or(""))?;
            let kf_interval = (chapter_interval / 6.0).max(10.0);
            let keyframes = extract_keyframes(
                video_path.to_str().unwrap_or(""),
                kf_interval,
                keyframe_dir.to_str().unwrap_or(""),
            )?;

            extract_audio_track(
                video_path.to_str().unwrap_or(""),
                audio_path.to_str().unwrap_or(""),
            )?;
            let segments = transcribe_audio(audio_path.to_str().unwrap_or(""), language)?;

            let chapters = generate_chapters(&segments, chapter_interval, duration);
            let (short, medium, long) = generate_summary(&segments, (summary_short, summary_medium, summary_long));
            let full_transcript: String = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");

            let mut fields = HashMap::new();
            fields.insert("summary".to_string(), serde_json::json!({"short": short, "medium": medium, "long": long}));
            fields.insert("chapters".to_string(), serde_json::json!(chapters));
            fields.insert("keyframes".to_string(), serde_json::json!(keyframes));
            fields.insert("transcript_text".to_string(), serde_json::json!(full_transcript));
            fields.insert("duration_seconds".to_string(), serde_json::json!(duration));

            let mut metadata = HashMap::new();
            metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
            metadata.insert("chapterCount".to_string(), serde_json::json!(chapters.len()));
            metadata.insert("keyframeCount".to_string(), serde_json::json!(keyframes.len()));
            metadata.insert("segmentCount".to_string(), serde_json::json!(segments.len()));

            Ok(EnrichmentResult {
                fields,
                confidence: if segments.is_empty() { 0.4 } else { 0.8 },
                metadata: Some(metadata),
            })
        })();

        // Cleanup
        let _ = std::fs::remove_file(&video_path);
        let _ = std::fs::remove_file(&audio_path);
        let _ = std::fs::remove_dir_all(&keyframe_dir);

        result
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let video_schemas = ["video", "movie", "clip", "recording", "lecture", "presentation"];
        let name_lower = schema.name.to_lowercase();
        video_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let size_kb = item.content.len() as f64 * 3.0 / 4.0 / 1024.0;
        let estimated_duration_sec = size_kb / 500.0;
        let keyframe_ms = estimated_duration_sec * 100.0;
        let transcription_ms = estimated_duration_sec * 33.0;
        let total_ms = keyframe_ms + transcription_ms + 5000.0;
        CostEstimate {
            tokens: None,
            api_calls: Some(1),
            duration_ms: Some(total_ms as u64),
        }
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
