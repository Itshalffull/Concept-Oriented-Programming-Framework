# Emitter Architecture

The Emitter concept manages all file I/O for the generation pipeline.

## Content-Addressed Writes

Every `write` or `writeBatch` call computes a SHA-256 hash of the
content. If the on-disk file already matches, the write is skipped.
This prevents unnecessary file-system churn and avoids triggering
downstream watchers.

## Source Provenance (sourceMap)

Each output file stores a list of sources that contributed to it:
- `sourcePath` — the input file (e.g., `specs/app/article.concept`)
- `conceptName` — the concept that produced it
- `actionName` — the action (e.g., `generate`)

This enables:
- `copf impact <file>` — which outputs change if this input changes
- `copf emitter trace <output>` — which inputs produced this output
- `copf emitter audit <dir>` — detect files modified outside generation

## Batch Writes

`writeBatch` writes multiple files atomically — if any file fails,
the batch reports the failure while the successful writes persist.
