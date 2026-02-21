---
name: tag
description: Manage tags and their association with articles 
 Tags are labels that can be applied to multiple articles
argument-hint: [command] [tag] [article]
---

# Tag

Manage tags and their association with articles 
 Tags are labels that can be applied to multiple articles

## Commands

### add
Add tag to tags set if not present 
 Add article to the tag s article set 
 Return tag reference

**Arguments:** `$0` **tag** (T), `$1` **article** (string)

### remove
Remove article from the tag s article set 
 Return tag reference

**Arguments:** `$0` **tag** (T), `$1` **article** (string)

### list
Return all known tags as a JSON encoded list
