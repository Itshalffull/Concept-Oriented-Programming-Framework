---
name: dev-server
description: Run a local development server that watches concept specs 
 and syncs for changes , re compiles on save , and serves 
 the generated artifacts
argument-hint: [command] [port] [specs] [syncs]
allowed-tools: Read, Bash
---

# DevServer

Run a local development server that watches concept specs 
 and syncs for changes , re compiles on save , and serves 
 the generated artifacts

## Step 1: Start Dev Server

Start the development server on the specified port 
 Watch the specs and syncs directories for changes 
 Auto recompile when files are modified

**Arguments:** `$0` **port** (int), `$1` **specs** (string), `$2` **syncs** (string)

**Examples:**
*Start dev server*
```bash
copf dev --port 3000
```

## Step 2: Check Status

Check the current status of a development server session

**Arguments:** `$0` **session** (D)

## Step 3: Stop Server

Stop a running development server session

**Arguments:** `$0` **session** (D)

**Examples:**
*Stop dev server*
```bash
copf dev stop
```
