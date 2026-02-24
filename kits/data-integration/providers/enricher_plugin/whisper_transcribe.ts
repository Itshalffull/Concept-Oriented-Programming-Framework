// COPF Data Integration Kit - Audio/video transcription enricher provider via Whisper
// Sends audio to Whisper API or runs locally, parses timestamped segments.

import * as https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const PROVIDER_ID = 'whisper_transcribe';
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

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

function parseWhisperJsonOutput(jsonStr: string): TranscriptSegment[] {
  try {
    const data = JSON.parse(jsonStr);
    const segments: TranscriptSegment[] = (data.segments ?? []).map((seg: any) => ({
      text: (seg.text ?? '').trim(),
      start: seg.start ?? 0,
      end: seg.end ?? 0,
      confidence: 1.0 - (seg.no_speech_prob ?? 0),
    }));
    return segments;
  } catch {
    return [];
  }
}

function parseSrtOutput(srt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = srt.split(/\n\n+/).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    // Parse timestamp line: "00:00:01,500 --> 00:00:04,200"
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );
    if (!timeMatch) continue;

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;
    const end =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    const text = lines.slice(2).join(' ').trim();
    segments.push({ text, start, end, confidence: 0.85 });
  }

  return segments;
}

async function transcribeLocal(
  audioPath: string,
  modelSize: WhisperModel,
  language: string,
): Promise<TranscriptSegment[]> {
  const outputPath = join(tmpdir(), `copf_whisper_${Date.now()}`);

  try {
    await execFileAsync('whisper', [
      audioPath,
      '--model', modelSize,
      '--language', language,
      '--output_format', 'json',
      '--output_dir', tmpdir(),
      '--output_file', outputPath,
    ], { timeout: 300000, maxBuffer: 50 * 1024 * 1024 });

    const jsonContent = readFileSync(`${outputPath}.json`, 'utf-8');
    return parseWhisperJsonOutput(jsonContent);
  } finally {
    try { unlinkSync(`${outputPath}.json`); } catch { /* best-effort */ }
  }
}

async function transcribeApi(
  audioB64: string,
  apiKey: string,
  model: string,
  language: string,
): Promise<TranscriptSegment[]> {
  const audioBuffer = Buffer.from(audioB64, 'base64');
  const boundary = `----CopfBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  // Build multipart/form-data for OpenAI Whisper API
  const addField = (name: string, value: string) => {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  };

  addField('model', model || 'whisper-1');
  addField('response_format', 'verbose_json');
  addField('timestamp_granularities[]', 'segment');
  if (language) addField('language', language);

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
  ));
  parts.push(audioBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString());
          const segments = (json.segments ?? []).map((seg: any) => ({
            text: (seg.text ?? '').trim(),
            start: seg.start ?? 0,
            end: seg.end ?? 0,
            confidence: seg.avg_logprob != null ? Math.exp(seg.avg_logprob) : 0.85,
          }));
          resolve(segments);
        } catch (e) {
          reject(new Error(`Failed to parse Whisper API response: ${e}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class WhisperTranscribeEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const modelSize = (config.options?.modelSize as WhisperModel) ?? 'base';
    const language = (config.options?.language as string) ?? 'en';
    const useApi = !!config.apiKey;

    let segments: TranscriptSegment[];

    if (useApi) {
      segments = await transcribeApi(item.content, config.apiKey!, config.model ?? 'whisper-1', language);
    } else {
      // Write audio to temp file for local processing
      const tmpPath = join(tmpdir(), `copf_audio_${item.id}_${Date.now()}.wav`);
      writeFileSync(tmpPath, Buffer.from(item.content, 'base64'));
      try {
        segments = await transcribeLocal(tmpPath, modelSize, language);
      } finally {
        try { unlinkSync(tmpPath); } catch { /* best-effort */ }
      }
    }

    const fullText = segments.map((s) => s.text).join(' ');
    const avgConfidence = segments.length > 0
      ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
      : 0;
    const totalDuration = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    return {
      fields: {
        transcript: {
          text: fullText,
          segments,
        },
        word_count: fullText.split(/\s+/).filter(Boolean).length,
        duration_seconds: totalDuration,
      },
      confidence: avgConfidence,
      metadata: {
        provider: PROVIDER_ID,
        modelSize,
        language,
        segmentCount: segments.length,
        mode: useApi ? 'api' : 'local',
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const audioSchemas = ['audio', 'video', 'podcast', 'recording', 'speech', 'media'];
    return audioSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const sizeKb = Buffer.byteLength(item.content, 'base64') / 1024;
    // Approximate audio duration from file size: ~16KB/sec for WAV, ~2KB/sec for compressed
    const isCompressed = item.contentType.includes('mp3') || item.contentType.includes('ogg');
    const bytesPerSec = isCompressed ? 2048 : 16384;
    const estimatedDurationSec = (sizeKb * 1024) / bytesPerSec;
    // Whisper processes ~30 seconds per second of audio on medium hardware
    const processingMs = Math.max(1000, estimatedDurationSec * 33);

    return {
      durationMs: Math.round(processingMs),
      apiCalls: 1,
    };
  }
}

export default WhisperTranscribeEnricherProvider;
