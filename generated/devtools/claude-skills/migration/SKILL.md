---
name: migration
description: Track concept schema versions and gate concept startup 
 Detect when a concept s deployed storage schema differs from 
 its current spec version and coordinate migration steps
argument-hint: [command] [concept] [specVersion]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Migration

Track concept schema versions and gate concept startup 
 Detect when a concept s deployed storage schema differs from 
 its current spec version and coordinate migration steps

## Step 1: Plan Migration

Analyze schema changes and plan migration steps for concept state transitions.

## Step 2: Apply Migration

Execute the planned migration, transforming stored state to match the new schema.
