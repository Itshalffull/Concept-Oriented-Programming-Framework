// Clef Data Integration Kit - Video summarization enricher provider
// Extracts keyframes at intervals, generates transcript via whisper, combines for chapter markers.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync, readdirSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const PROVIDER_ID = 'video_summary';
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

interface Chapter {
  title: string;
  start: number;
  end: number;
}

interface Keyframe {
  timestamp: number;
  description: string;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

async function getVideoDuration(videoPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    videoPath,
  ]);
  const info = JSON.parse(stdout);
  return parseFloat(info.format?.duration ?? '0');
}

async function extractKeyframes(
  videoPath: string,
  intervalSec: number,
  outputDir: string,
): Promise<Keyframe[]> {
  // Extract frames at regular intervals using ffmpeg scene detection + interval
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vf', `fps=1/${intervalSec},select='gt(scene\\,0.3)+not(mod(n\\,1))'`,
    '-vsync', 'vfr',
    '-q:v', '2',
    join(outputDir, 'keyframe_%04d.jpg'),
  ], { timeout: 120000 });

  const files = readdirSync(outputDir)
    .filter((f) => f.startsWith('keyframe_'))
    .sort();

  return files.map((file, idx) => ({
    timestamp: idx * intervalSec,
    description: `Keyframe at ${formatTimestamp(idx * intervalSec)}`,
  }));
}

async function extractAudioTrack(videoPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    outputPath,
  ], { timeout: 120000 });
}

async function transcribeAudio(audioPath: string, language: string): Promise<TranscriptSegment[]> {
  const { stdout } = await execFileAsync('whisper', [
    audioPath,
    '--model', 'base',
    '--language', language,
    '--output_format', 'json',
    '--output_dir', tmpdir(),
  ], { timeout: 300000 });

  const baseName = audioPath.replace(/\.[^.]+$/, '');
  const jsonPath = `${baseName}.json`;

  try {
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    return (data.segments ?? []).map((seg: any) => ({
      text: (seg.text ?? '').trim(),
      start: seg.start ?? 0,
      end: seg.end ?? 0,
    }));
  } catch {
    return [];
  } finally {
    try { unlinkSync(jsonPath); } catch { /* best-effort */ }
  }
}

function generateChapters(
  segments: TranscriptSegment[],
  chapterInterval: number,
  totalDuration: number,
): Chapter[] {
  const chapters: Chapter[] = [];
  let chapterStart = 0;

  while (chapterStart < totalDuration) {
    const chapterEnd = Math.min(chapterStart + chapterInterval, totalDuration);

    // Collect transcript segments within this chapter window
    const chapterSegments = segments.filter(
      (s) => s.start >= chapterStart && s.start < chapterEnd,
    );

    // Generate chapter title from first meaningful sentence or key phrases
    let title = `Chapter at ${formatTimestamp(chapterStart)}`;
    if (chapterSegments.length > 0) {
      const combinedText = chapterSegments.map((s) => s.text).join(' ');
      // Extract most significant phrase (first sentence or first N words)
      const firstSentence = combinedText.split(/[.!?]/).filter(Boolean)[0] ?? '';
      title = firstSentence.trim().slice(0, 80) || title;
    }

    chapters.push({ title, start: chapterStart, end: chapterEnd });
    chapterStart = chapterEnd;
  }

  return chapters;
}

function generateSummary(
  segments: TranscriptSegment[],
  lengths: { short: number; medium: number; long: number },
): { short: string; medium: string; long: string } {
  const fullText = segments.map((s) => s.text).join(' ');
  const sentences = fullText.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  // Score sentences by position and keyword density
  const scoredSentences = sentences.map((sentence, idx) => {
    let score = 0;
    // Position bonus: first and last sentences score higher
    if (idx === 0) score += 3;
    if (idx === sentences.length - 1) score += 2;
    if (idx < sentences.length * 0.2) score += 1;

    // Length bonus: prefer medium-length sentences
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 8 && wordCount <= 25) score += 2;

    return { sentence: sentence.trim(), score };
  });

  scoredSentences.sort((a, b) => b.score - a.score);

  const pickSentences = (count: number): string =>
    scoredSentences
      .slice(0, count)
      .map((s) => s.sentence)
      .join('. ') + '.';

  return {
    short: pickSentences(lengths.short),
    medium: pickSentences(lengths.medium),
    long: pickSentences(lengths.long),
  };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export class VideoSummaryEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const chapterInterval = (config.options?.chapterInterval as number) ?? 300; // 5 minutes
    const summaryLengths = (config.options?.summaryLengths as { short: number; medium: number; long: number }) ??
      { short: 2, medium: 5, long: 10 };
    const language = (config.options?.language as string) ?? 'en';

    // Write video to temp file
    const videoPath = join(tmpdir(), `clef_video_${item.id}_${Date.now()}.mp4`);
    const audioPath = join(tmpdir(), `clef_audio_${item.id}_${Date.now()}.wav`);
    const keyframeDir = mkdtempSync(join(tmpdir(), 'clef_keyframes_'));

    writeFileSync(videoPath, Buffer.from(item.content, 'base64'));

    try {
      // Step 1: Get video duration
      const duration = await getVideoDuration(videoPath);

      // Step 2: Extract keyframes at chapter intervals
      const keyframeInterval = Math.max(10, chapterInterval / 6);
      const keyframes = await extractKeyframes(videoPath, keyframeInterval, keyframeDir);

      // Step 3: Extract audio and transcribe
      await extractAudioTrack(videoPath, audioPath);
      const segments = await transcribeAudio(audioPath, language);

      // Step 4: Generate chapters from transcript
      const chapters = generateChapters(segments, chapterInterval, duration);

      // Step 5: Generate multi-length summaries
      const summary = generateSummary(segments, summaryLengths);

      const fullTranscript = segments.map((s) => s.text).join(' ');

      return {
        fields: {
          summary,
          chapters,
          keyframes,
          transcript_text: fullTranscript,
          duration_seconds: duration,
        },
        confidence: segments.length > 0 ? 0.8 : 0.4,
        metadata: {
          provider: PROVIDER_ID,
          chapterCount: chapters.length,
          keyframeCount: keyframes.length,
          segmentCount: segments.length,
          language,
        },
      };
    } finally {
      try { unlinkSync(videoPath); } catch { /* cleanup */ }
      try { unlinkSync(audioPath); } catch { /* cleanup */ }
      try {
        readdirSync(keyframeDir).forEach((f) => unlinkSync(join(keyframeDir, f)));
        rmdirSync(keyframeDir);
      } catch { /* cleanup */ }
    }
  }

  appliesTo(schema: SchemaRef): boolean {
    const videoSchemas = ['video', 'movie', 'clip', 'recording', 'lecture', 'presentation'];
    return videoSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const sizeKb = Buffer.byteLength(item.content, 'base64') / 1024;
    // Video: ~500KB/sec compressed. Estimate total processing time
    const estimatedDurationSec = sizeKb / 500;
    const keyframeExtractionMs = estimatedDurationSec * 100;
    const transcriptionMs = estimatedDurationSec * 33;
    const totalMs = keyframeExtractionMs + transcriptionMs + 5000;

    return {
      durationMs: Math.round(totalMs),
      apiCalls: 1,
    };
  }
}

export default VideoSummaryEnricherProvider;
