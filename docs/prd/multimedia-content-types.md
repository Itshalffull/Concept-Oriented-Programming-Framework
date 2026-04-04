# Multimedia Content Types — PRD

## Status: Draft
## Date: 2026-04-03

---

## Epic: `MAG-362` — Epic: Multimedia Content Types

## Card Index

| PRD Section | Card ID | Title |
|------------|---------|-------|
| 12 Phase A | `MAG-363` | Phase A: Concepts & Schemas |
| 3.1 Transcript | `MAG-369` | Concept + Schema: Transcript [T] |
| 3.1 Transcript | `MAG-370` | Handler: Transcript |
| 3.2 Clip | `MAG-371` | Concept + Schema: Clip [C] |
| 3.2 Clip | `MAG-372` | Handler: Clip |
| 3.3 Region | `MAG-373` | Concept + Schema: Region [R] |
| 3.3 Region | `MAG-374` | Handler: Region |
| 3.4 AnnotationLayer | `MAG-375` | Concept + Schema: AnnotationLayer [L] |
| 3.4 AnnotationLayer | `MAG-376` | Handler: AnnotationLayer |
| 12 Phase A | `MAG-377` | Conformance Tests: all four concepts |
| 12 Phase B | `MAG-364` | Phase B: Canvas Display Modes |
| 4.1 transcript-player | `MAG-378` | Display Mode: transcript-player |
| 4.2 image-annotator | `MAG-379` | Display Mode: image-annotator |
| 4.3 waveform-player | `MAG-380` | Display Mode: waveform-player |
| 12 Phase C | `MAG-365` | Phase C: Widgets |
| 6.1 MediaPlayer | `MAG-381` | Widget: MediaPlayer |
| 6.2 TranscriptView | `MAG-382` | Widget: TranscriptView |
| 6.3 WaveformTimeline | `MAG-383` | Widget: WaveformTimeline |
| 6.4 RegionOverlay | `MAG-384` | Widget: RegionOverlay |
| 6.5 LayerSelector | `MAG-385` | Widget: LayerSelector |
| 12 Phase D | `MAG-366` | Phase D: Embed Display Modes & Toolbar Extensions |
| 5.1 clip-embed | `MAG-386` | Display Mode: clip-embed |
| 5.2 region-embed | `MAG-387` | Display Mode: region-embed |
| 7.1 SpanToolbar | `MAG-388` | SpanToolbar: "Create Clip" button |
| 7.2 Image toolbar | `MAG-389` | Image toolbar: "Create Region" button |
| 12 Phase E | `MAG-367` | Phase E: Enricher Providers & Processing Syncs |
| 8.1 Whisper | `MAG-390` | Provider: WhisperTranscriptionProvider |
| 8.2 OCR | `MAG-391` | Provider: OCRProvider |
| 8.3 Structure | `MAG-392` | Provider: StructureExtractionProvider |
| 11 CLIP | `MAG-393` | Provider: CLIPEmbeddingProvider |
| 10.1 transcription syncs | `MAG-394` | Sync: upload-triggers-transcription + transcription-creates-transcript |
| 10.1 OCR sync | `MAG-395` | Sync: upload-triggers-ocr |
| 11 modality | `MAG-396` | ContentEmbedding: add modality field |
| 12 Phase F | `MAG-368` | Phase F: Views, Destinations & Annotation Layer Syncs |
| 9.1 Media Library | `MAG-397` | View + Destination: Media Library (/media) |
| 9.2 Transcripts | `MAG-398` | View + Destination: Transcripts (/transcripts) |
| 9.3 Clips | `MAG-399` | View + Destination: Clips (/clips) |
| 10.2 staleness syncs | `MAG-400` | Syncs: source-update-stales-clips + source-update-stales-regions |
| 10.3 layer syncs | `MAG-401` | Syncs: annotation layer scoping |

---

## 1. Problem Statement

Clef's content system handles text entities well — ContentNodes with the BlockEditor, TextAnchor/TextSpan for sub-block addressing, Snippets for referenceable excerpts. But multimedia content (audio, video, images, PDFs) has no first-class representation beyond basic file upload via MediaAsset/FileManagement.

Users cannot:
- Upload audio and get a searchable, annotatable transcript
- Select 30 seconds of a podcast and share it as a referenceable clip
- Draw a region on an architecture diagram and reference it from another entity
- Scope annotations to "my draft layer" vs "published layer"
- Search across text and media in a unified query (cross-modal search)

The infrastructure exists — MediaAsset handles files, ContentEmbedding handles vectors, the Capture/Enricher pipeline handles processing, TextSpan handles text selection. What's missing: **the content types and display modes that compose these into a user-friendly multimedia experience**.

---

## 2. Design Principles

1. **Everything is content.** Transcript, Clip, Region, AnnotationLayer are ContentNodes with schemas. They go through ContentStorage, get entity pages, participate in search and backlinks automatically.

2. **Schema drives UI.** Adding a schema to a content type gives it CRUD, views, display modes, and entity lifecycle syncs for free. No special wiring.

3. **Zone 2 is the only thing that changes.** The triple-zone entity page stays — fieldset (Zone 1) and related entities (Zone 3) work automatically from schema. Only the canvas zone (Zone 2) needs new display modes for multimedia rendering.

4. **Extend, don't replace.** SpanToolbar, highlighting, commenting, snippet creation all work on transcript text exactly like BlockEditor text. We add buttons to existing toolbars, not new toolbars.

5. **Processing is Enricher providers.** Transcription, OCR, structure extraction are Enricher providers in the existing Capture pipeline. No new processing concepts.

---

## 3. New Concepts

### 3.1 Transcript [T]

#### Purpose

Represent a time-synchronized text transcript of audio or video content, with word-level timestamps and speaker diarization. The transcript IS content — its segments are blocks with timestamp metadata, so all text operations (highlighting, commenting, snippet creation) work naturally.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `segments` | set T | Transcript segments |
| `sourceEntity` | T -> String | MediaAsset entity ID (audio/video source) |
| `language` | T -> option String | Detected or specified language |
| `speakers` | T -> option String | JSON array of speaker labels |
| `segment.startTime` | T -> String | Segment start time in seconds |
| `segment.endTime` | T -> String | Segment end time in seconds |
| `segment.speaker` | T -> option String | Speaker label for this segment |
| `segment.words` | T -> option String | JSON array of `{word, start, end, confidence}` for word-level timing |
| `segment.content` | T -> String | Segment text content |
| `status` | T -> String | `"processing"`, `"ready"`, `"error"` |
| `duration` | T -> option String | Total duration in seconds |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, error | Create transcript entity linked to source MediaAsset. |
| `addSegment` | ok, notfound | Add a segment with timing, speaker, and word-level data. |
| `seekToWord` | ok, notfound | Given a word index or text offset, return the timestamp for playback seeking. |
| `getSegmentAt` | ok, notfound | Given a timestamp, return the segment and word at that time. |
| `setSpeaker` | ok, notfound | Assign or change speaker label for a segment. |
| `get` | ok, notfound | Return full transcript metadata. |
| `list` | ok | List transcripts, optionally filtered by source entity. |
| `delete` | ok, notfound | Delete transcript (does not delete source MediaAsset). |

#### Schema

```yaml
schema: transcript
entities:
  Transcript:
    fields:
      sourceEntity: { type: Reference, required: true }
      language: { type: String }
      speakers: { type: JSON }
      duration: { type: String }
      status: { type: String, enum: [processing, ready, error], default: processing }
    display_modes: [transcript-player, entity-page]
```

#### Operational Principle

User uploads audio/video → Enricher pipeline triggers WhisperTranscriptionProvider → transcript entity created with segments. User reads transcript, clicks any word to seek playback. Selects words → SpanToolbar appears with standard text actions + "Create Clip" button (because selected words carry timestamps). Transcript text participates in search, backlinks, and embedding.

---

### 3.2 Clip [C]

#### Purpose

Represent a temporal segment extracted from audio or video — the time-domain analog of Snippet. A Clip is a first-class entity referencing a source MediaAsset with a start/end time range, optionally linked to a Transcript word range.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `clips` | set C | All clips |
| `sourceEntity` | C -> String | MediaAsset entity ID |
| `startTime` | C -> String | Start time in seconds |
| `endTime` | C -> String | End time in seconds |
| `transcript` | C -> option String | Transcript entity ID (if source has one) |
| `transcriptText` | C -> option String | Cached resolved text from transcript range |
| `label` | C -> option String | Human-readable label |
| `kind` | C -> option String | `"quote"`, `"highlight"`, `"excerpt"`, `"reference"` |
| `status` | C -> String | `"active"`, `"stale"` (source modified) |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, error | Create clip with source + time range. |
| `resolve` | ok, stale, notfound | Resolve clip — verify source exists, extract transcript text if available. |
| `get` | ok, notfound | Return clip metadata. |
| `list` | ok | List clips, optionally by source entity. |
| `setLabel` | ok, notfound | Update label. |
| `delete` | ok, notfound | Delete clip (does not delete source). |

#### Schema

```yaml
schema: clip
entities:
  Clip:
    fields:
      sourceEntity: { type: Reference, required: true }
      startTime: { type: String, required: true }
      endTime: { type: String, required: true }
      transcript: { type: Reference }
      transcriptText: { type: String }
      label: { type: String }
      kind: { type: String, enum: [quote, highlight, excerpt, reference] }
      status: { type: String, enum: [active, stale], default: active }
    display_modes: [clip-embed, entity-page]
```

#### Operational Principle

User selects words in TranscriptView → clicks "Create Clip" → Clip entity created with time range derived from word timestamps. OR user drags a range on the waveform/timeline → Clip created from time selection. Clip embeds in other content via entity-embed with clip-embed display mode (mini player + transcript text).

---

### 3.3 Region [R]

#### Purpose

Represent a spatial sub-area of visual media (image, PDF page, video frame) — the spatial analog of Snippet. A Region is a first-class entity with normalized coordinates, shape type, and optional snapshot.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `regions` | set R | All regions |
| `sourceEntity` | R -> String | MediaAsset entity ID (image/PDF/video) |
| `bounds` | R -> String | JSON: `{x, y, width, height}` normalized 0-1 coordinates |
| `shape` | R -> String | `"rect"`, `"polygon"`, `"freeform"` |
| `points` | R -> option String | JSON array of points for polygon/freeform shapes |
| `page` | R -> option String | PDF page number or video frame timestamp |
| `snapshot` | R -> option String | Cached cropped image (base64 or file ref) |
| `label` | R -> option String | Human-readable label |
| `kind` | R -> option String | `"annotation"`, `"highlight"`, `"crop"`, `"reference"` |
| `status` | R -> String | `"active"`, `"stale"` (source modified) |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, error | Create region with source + bounds/shape. |
| `resolve` | ok, stale, notfound | Verify source exists, regenerate snapshot if needed. |
| `crop` | ok, notfound | Extract the region as a standalone image. |
| `get` | ok, notfound | Return region metadata. |
| `list` | ok | List regions, optionally by source entity. |
| `setLabel` | ok, notfound | Update label. |
| `delete` | ok, notfound | Delete region (does not delete source). |

#### Schema

```yaml
schema: region
entities:
  Region:
    fields:
      sourceEntity: { type: Reference, required: true }
      bounds: { type: JSON, required: true }
      shape: { type: String, required: true, enum: [rect, polygon, freeform] }
      points: { type: JSON }
      page: { type: String }
      snapshot: { type: String }
      label: { type: String }
      kind: { type: String, enum: [annotation, highlight, crop, reference] }
      status: { type: String, enum: [active, stale], default: active }
    display_modes: [region-embed, entity-page]
```

#### Operational Principle

User draws a rectangle on an image → Region entity created with normalized bounds. User can "Create Region" from the image toolbar, copy a region reference, and embed it in other content via entity-embed with region-embed display mode (shows cropped area with source attribution).

---

### 3.4 AnnotationLayer [L]

#### Purpose

Scope annotations (TextSpans, Comments, InlineAnnotations) to named layers per document. Layers enable "my draft notes" vs "team review" vs "published annotations" — annotations exist in a layer, and toggling layer visibility filters which annotations render.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `layers` | set L | All layers |
| `entityRef` | L -> String | Document entity ID this layer belongs to |
| `name` | L -> String | Layer name: `"personal"`, `"team-review"`, `"published"` |
| `owner` | L -> option String | Layer owner (user/agent ID) |
| `visibility` | L -> String | `"visible"`, `"hidden"` |
| `color` | L -> option String | Layer color hint for annotation rendering |
| `annotations` | L -> set String | Set of annotation IDs (TextSpan, Comment, InlineAnnotation) in this layer |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, duplicate | Create a named layer for an entity. |
| `addAnnotation` | ok, notfound | Add an annotation ID to this layer. |
| `removeAnnotation` | ok, notfound | Remove an annotation from this layer. |
| `setVisibility` | ok, notfound | Toggle layer visibility. |
| `export` | ok, notfound | Merge all annotations from this layer into the document's default layer. |
| `flatten` | ok, notfound | Permanently embed this layer's annotations into the document (remove layer, keep annotations). |
| `get` | ok, notfound | Return layer metadata and annotation count. |
| `list` | ok | List layers for an entity. |
| `delete` | ok, notfound | Delete layer and all its annotations. |

#### Schema

```yaml
schema: annotation-layer
entities:
  AnnotationLayer:
    fields:
      entityRef: { type: Reference, required: true }
      name: { type: String, required: true }
      owner: { type: Reference }
      visibility: { type: String, enum: [visible, hidden], default: visible }
      color: { type: String }
    display_modes: [entity-page]
```

#### Operational Principle

When a user creates an annotation (TextSpan, Comment), the UI checks which layer is active and calls `addAnnotation` to scope it. Toggling layer visibility filters which annotations render in the SpanGutter, SpanToolbar, and content overlay. Export merges layer annotations into the default layer. Flatten makes them permanent.

---

## 4. Canvas Display Modes

These render in Zone 2 (canvas) of the triple-zone entity page, replacing BlockEditor for multimedia entities.

### 4.1 transcript-player

For entities with `transcript` schema.

| Component | Widget | Description |
|-----------|--------|-------------|
| Top | MediaPlayer | Audio/video player with seek, play/pause, speed, volume |
| Bottom | TranscriptView | Synchronized scrolling segments with timestamp gutter, click-to-seek, word-level text selection |

TranscriptView text is selectable — SpanToolbar appears on selection with standard actions (highlight, comment, cite, excerpt, copy snippet reference) plus **"Create Clip"** button. Selecting words defines a time range because words carry timestamps.

### 4.2 image-annotator

For entities with image MIME types.

| Component | Widget | Description |
|-----------|--------|-------------|
| Main | Image + RegionOverlay | Image viewer with SVG overlay for drawing/selecting regions |
| Toolbar | Image tools | Draw rect, draw polygon, select, pan, zoom |

Drawing a region and clicking "Create Region" creates a Region entity. Existing regions render as colored overlays. Clicking a region selects it and shows metadata.

### 4.3 waveform-player

For audio entities without a transcript.

| Component | Widget | Description |
|-----------|--------|-------------|
| Main | WaveformTimeline | Audio waveform visualization with scrub cursor and range selection |
| Controls | Processing buttons | [Transcribe] triggers Enricher pipeline. [Split] creates Clip at cursor. |

Dragging a range on the waveform → "Create Clip" creates a Clip entity from the time selection.

---

## 5. Embed Display Modes

These render when multimedia entities are embedded in other content via entity-embed.

### 5.1 clip-embed

Compact playback for embedded Clip entities.

```
┌──────────────────────────────────────┐
│ Clip from source_name · 12:34-13:02  │
│  ▶ ▬▬▬●━━  0:28                     │
│  "transcript text if available..."   │
│                       View in context │
└──────────────────────────────────────┘
```

Status indicators: powered by **VersionPinBadge** widget (see `version-aware-spans-prd.md` §5.3):
- `current` → no indicator (clean)
- `outdated` → ↻ icon + "Source updated · [Update] [Keep pinned]"
- `orphaned` → ⚠ icon + "Source removed · [View original]"

### 5.2 region-embed

Compact display for embedded Region entities.

```
┌──────────────────────────────────────┐
│ Region from source_name              │
│  ┌─────────────────┐                │
│  │  [cropped image] │                │
│  └─────────────────┘                │
│                       View in context │
└──────────────────────────────────────┘
```

Status indicators: powered by **VersionPinBadge** — same widget as clip-embed and text span indicators.

> **UI Unification:** The VersionPin PRD defines three generic widgets that serve ALL
> content-referencing concepts — text spans, block embeds, clips, regions, snippets:
>
> - **VersionPinBadge** — inline indicator (↻ outdated, ⚠ orphaned). Used in clip-embed,
>   region-embed, span highlights, block embed borders. One widget, many contexts.
> - **VersionPinPanel** — sidebar showing ALL pinned references for an entity. Text spans,
>   clips, regions, block embeds appear together, grouped by freshness. Batch "Update all."
> - **VersionDiffPopover** — original vs current content diff. For clips: original audio range
>   vs current. For regions: original crop vs current image. For spans: original text vs current.
>
> These widgets replace the need for per-concept status indicators — clip-embed and region-embed
> embed VersionPinBadge rather than implementing their own status rendering.

---

## 6. New Widgets

### 6.1 MediaPlayer

Headless audio/video player. Anatomy: root, playButton, seekBar, timeDisplay, speedControl, volumeControl. States: idle, playing, paused, buffering, ended. Wraps HTML5 `<audio>`/`<video>`. Exposes current time as a signal for TranscriptView synchronization.

### 6.2 TranscriptView

Synchronized transcript renderer. Anatomy: root, segmentList, segment, timestampGutter, speakerLabel, wordSpan. Reads current time from MediaPlayer signal, auto-scrolls to active segment, highlights active word. Text is selectable — integrates with SpanToolbar. Selection carries timestamp metadata so "Create Clip" can derive time range.

### 6.3 WaveformTimeline

Audio waveform visualization. Anatomy: root, waveform, cursor, rangeSelection, timeAxis. States: idle, scrubbing, selecting. Renders waveform from audio data (Web Audio API / pre-computed peaks). Cursor syncs with MediaPlayer position. Range selection defines start/end time for clip creation.

### 6.4 RegionOverlay

SVG overlay for spatial selection on images. Anatomy: root, image, overlay, region, handle. States: idle, drawing, resizing, selected. Supports rect and polygon shapes. Coordinates normalized to 0-1 range. Existing regions render as colored SVG shapes.

### 6.5 LayerSelector

Annotation layer toggle. Anatomy: root, layerList, layerItem, visibilityToggle, colorDot. Simple toggle-group — same interaction pattern as existing filter toggles in ViewRenderer. Each layer item shows name, color, annotation count, and visibility toggle.

---

## 7. Toolbar Extensions

### 7.1 SpanToolbar — "Create Clip" button

When text is selected in a TranscriptView, the SpanToolbar gains a "Create Clip" button after the existing actions. This button:
1. Reads the selected words' start/end timestamps
2. Creates a Clip entity with the time range + source MediaAsset
3. Copies `((clipEntityId))` to clipboard
4. Shows toast: "Clip created"

### 7.2 Image Toolbar — "Create Region" button

When a region is drawn on RegionOverlay, an image toolbar appears with:
1. "Create Region" → creates Region entity with normalized bounds
2. "Copy Region Reference" → copies `((sourceEntityId#region=regionId))`
3. Label/kind editing

---

## 8. Enricher Providers

New Enricher providers for the existing Capture/Enricher pipeline. No new concepts — these are provider registrations.

### 8.1 WhisperTranscriptionProvider

Pipeline: `audio/video MediaAsset → Whisper API → Transcript entity with segments`

Triggers when: MediaAsset uploaded with audio/video MIME type and no linked Transcript. Or manually via [Transcribe] button in waveform-player display mode.

### 8.2 OCRProvider

Pipeline: `image/PDF MediaAsset → OCR API → text blocks added to entity content`

Triggers when: MediaAsset uploaded with image/PDF MIME type. Or manually via [OCR] button.

### 8.3 StructureExtractionProvider

Pipeline: `PDF MediaAsset → Structure extraction → sections/figures/tables as child entities`

Triggers when: PDF upload. Extracts document structure into typed ContentNodes (section, figure, table) linked to source.

---

## 9. Views & Destinations

### 9.1 Media Library

| Field | Value |
|-------|-------|
| Destination | `/media` |
| View | `card-grid` of MediaAsset entities |
| Filters | MIME type (image, audio, video, document), tags |
| Controls | Upload button |

### 9.2 Transcripts

| Field | Value |
|-------|-------|
| Destination | `/transcripts` |
| View | `table` of Transcript entities |
| Filters | Status (processing, ready), language, source entity |

### 9.3 Clips

| Field | Value |
|-------|-------|
| Destination | `/clips` |
| View | `card-grid` of Clip entities |
| Display | Mini player per card with duration badge |

---

## 10. Syncs

### 10.1 Auto-Processing Syncs

| Sync | Trigger | Effect |
|------|---------|--------|
| `upload-triggers-transcription` | MediaAsset/createMedia -> ok (audio/video MIME) | Enricher/augment(pipeline: "transcribe") |
| `transcription-creates-transcript` | Enricher/augment -> ok(pipeline: "transcribe") | Transcript/create + Transcript/addSegment per segment |
| `upload-triggers-ocr` | MediaAsset/createMedia -> ok (image/PDF MIME) | Enricher/augment(pipeline: "ocr") |

### 10.2 Clip/Region Staleness → VersionPin

> **Cross-reference:** The staleness tracking for Clips and Regions (status: active|stale,
> resolve → stale variant) is the same independent behavior that TextSpan, BlockEmbed, and
> SnippetEmbed need. This has been extracted into the **VersionPin** concept — see
> `docs/prd/version-aware-spans-prd.md`.
>
> Rather than each concept reimplementing staleness detection, VersionPin handles:
> - Capturing the source version at creation time
> - Detecting when the source has moved ahead (freshness: current/outdated/orphaned)
> - Policy-driven update behavior (auto for highlights, pin for citations/excerpts)
> - Batch freshness checks when a source entity changes
> - Original content retrieval from the pinned version
>
> **Impact on this PRD:**
> - Clip's `status: active|stale` field → replaced by VersionPin freshness
> - Region's `status: active|stale` field → replaced by VersionPin freshness
> - `source-update-stales-clips` sync → replaced by `content-change-checks-pins` (generic)
> - `source-update-stales-regions` sync → replaced by `content-change-checks-pins` (generic)
> - Clip/resolve `stale` variant → driven by VersionPin/checkFreshness → outdated
> - Region/resolve `stale` variant → driven by VersionPin/checkFreshness → outdated
> - Clip and Region gain version-aware UI indicators (VersionPinBadge) for free
>
> New syncs (from VersionPin PRD, replacing the ones below):
> - `clip-creates-pin.sync` — Clip/create → VersionPin/create (policy: "pin")
> - `region-creates-pin.sync` — Region/create → VersionPin/create (policy: "auto")
> - `transcript-creates-pin.sync` �� Transcript/create → VersionPin/create (policy: "pin")
> - `media-change-checks-pins.sync` — MediaAsset change → VersionPin/batchReanchor

**Original syncs (superseded by VersionPin):**

| Sync | Trigger | Effect |
|------|---------|--------|
| ~~`source-update-stales-clips`~~ | ~~ContentStorage/save~~ | ~~Clip/resolve~~ |
| ~~`source-update-stales-regions`~~ | ~~ContentStorage/save~~ | ~~Region/resolve~~ |

### 10.3 Annotation Layer Syncs

| Sync | Trigger | Effect |
|------|---------|--------|
| `span-creates-in-active-layer` | TextSpan/create -> ok | AnnotationLayer/addAnnotation (to active layer) |
| `comment-creates-in-active-layer` | Comment/addComment -> ok | AnnotationLayer/addAnnotation (to active layer) |
| `layer-visibility-filters-spans` | AnnotationLayer/setVisibility -> ok | Signal/batch (update span visibility signals) |

---

## 11. ContentEmbedding Extension

Add `modality` field to ContentEmbedding to support cross-modal search:

| Field | Type | Description |
|-------|------|-------------|
| `modality` | E -> String | `"text"`, `"image"`, `"audio"`, `"video"` |

This enables CLIP-style cross-modal search: embed images and text in a shared vector space so "find images similar to this text description" works via ContentEmbedding/searchSimilar.

New embedding provider: **CLIPEmbeddingProvider** — projects both images and text into a shared vector space using CLIP/ImageBind.

---

## 12. Implementation Sequence

### Phase A: Concepts & Schemas

- Concept: Transcript [T]
- Schema: transcript.schema.yaml
- Handler: Transcript
- Concept: Clip [C]
- Schema: clip.schema.yaml
- Handler: Clip
- Concept: Region [R]
- Schema: region.schema.yaml
- Handler: Region
- Concept: AnnotationLayer [L]
- Schema: annotation-layer.schema.yaml
- Handler: AnnotationLayer
- Conformance Tests: all four

### Phase B: Canvas Display Modes

- Display mode: transcript-player.yaml
- Display mode: image-annotator.yaml
- Display mode: waveform-player.yaml

### Phase C: Widgets

- Widget: MediaPlayer
- Widget: TranscriptView
- Widget: WaveformTimeline
- Widget: RegionOverlay
- Widget: LayerSelector

### Phase D: Embed Display Modes & Toolbar Extensions

- Display mode: clip-embed.yaml
- Display mode: region-embed.yaml
- SpanToolbar: "Create Clip" button
- Image toolbar: "Create Region" button

### Phase E: Enricher Providers & Processing Syncs

- Provider: WhisperTranscriptionProvider
- Provider: OCRProvider
- Provider: StructureExtractionProvider
- Provider: CLIPEmbeddingProvider
- Sync: upload-triggers-transcription
- Sync: transcription-creates-transcript
- Sync: upload-triggers-ocr
- ContentEmbedding modality field extension

### Phase F: Views & Destinations

- View + Destination: Media Library (/media)
- View + Destination: Transcripts (/transcripts)
- View + Destination: Clips (/clips)
- ~~Sync: source-update-stales-clips~~ → superseded by VersionPin (see `version-aware-spans-prd.md`)
- ~~Sync: source-update-stales-regions~~ → superseded by VersionPin
- Sync: span-creates-in-active-layer
- Sync: comment-creates-in-active-layer
- Sync: layer-visibility-filters-spans

---

## 13. Concept Independence Verification

| Principle | Transcript | Clip | Region | AnnotationLayer |
|-----------|-----------|------|--------|-----------------|
| **Independent purpose** | Time-synced text from audio/video | Temporal segment extraction | Spatial sub-area extraction | Annotation scoping |
| **Own state** | segments, speakers, timing | source + time range | source + bounds/shape | layers, annotations, visibility |
| **No concept coupling** | Doesn't import MediaAsset or Clip | Doesn't import Transcript or Region | Doesn't import MediaAsset or Transcript | Doesn't import TextSpan or Comment |
| **Sync-only composition** | Linked to MediaAsset via sync | Time range from Transcript words via sync | Bounds from image interaction via sync | Annotations scoped via sync |
| **Useful alone** | Meeting notes, lecture notes (no audio) | Audio excerpt sharing | Image annotation, diagram markup | Review workflows, draft notes |
