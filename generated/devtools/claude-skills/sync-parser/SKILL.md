---
name: sync-parser
description: Parse sync files into structured ASTs and validate 
 against concept manifests
argument-hint: [command] [source] [manifests]
---

# SyncParser

Parse sync files into structured ASTs and validate 
 against concept manifests

## Commands

### parse
Tokenize and parse the sync source Resolve all 
 concept and action references against the provided 
 manifests Store the sync reference and its AST

**Arguments:** `$0` **source** (string), `$1` **manifests** (manifest[])
