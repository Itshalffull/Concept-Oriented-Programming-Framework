---
name: deployment-validator
description: Parse and validate deployment manifests against compiled concepts 
 and syncs Produce deployment plans with transport assignments , 
 runtime mappings , and sync to engine bindings
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# DeploymentValidator

Parse and validate deployment manifests against compiled concepts 
 and syncs Produce deployment plans with transport assignments , 
 runtime mappings , and sync to engine bindings

## Step 1: Validate Deployment Manifest

Validate that deployment manifests correctly map concepts to runtimes, assign syncs to engines, and satisfy capability requirements.

**Arguments:** `$0` **manifest** (M), `$1` **concepts** (conceptmanifest[]), `$2` **syncs** (compiledsync[])

## References

- [Deployment configuration guide](references/deployment-guide.md)
