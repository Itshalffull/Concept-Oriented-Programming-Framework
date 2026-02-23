---
name: kit-manager
description: Manage concept kits scaffold new kits , validate kit 
 manifests and cross kit references , run kit tests , list 
 active kits , and check app overrides
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# KitManager

Manage concept kits scaffold new kits , validate kit 
 manifests and cross kit references , run kit tests , list 
 active kits , and check app overrides

## Step 1: Create Kit

Scaffold a new kit directory with kit yaml , concept 
 and sync subdirectories , and example files

**Arguments:** `$0` **name** (string)

**Examples:**
*Create a new kit*
```bash
copf kit init my-kit
```

## Step 2: Validate Kit

Validate a kit manifest , its concept specs , sync 
 definitions , and cross kit concept references

**Arguments:** `$0` **path** (string)

**Examples:**
*Validate a kit*
```bash
copf kit validate ./kits/my-kit
```

## Step 3: Test Kit

Run conformance and integration tests for a kit 
 Tests invariants from concept specs and validates 
 sync compilation

**Arguments:** `$0` **path** (string)

## Step 4: List Active Kits

List all kits used by the current application , 
 including their versions and concept counts

## Step 5: Check Overrides

Verify that application sync overrides reference 
 valid syncs in the target kit

**Arguments:** `$0` **path** (string)
