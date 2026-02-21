---
name: comment
description: Manage comments on articles Each comment has a body , 
 target article reference , and author reference
argument-hint: [command] [comment] [body] [target] [author]
---

# Comment

Manage comments on articles Each comment has a body , 
 target article reference , and author reference

## Commands

### create
Add comment to set Store body , target , author , and createdAt 
 Return comment reference

**Arguments:** `$0` **comment** (C), `$1` **body** (string), `$2` **target** (string), `$3` **author** (string)

### delete
Remove comment from set Delete all fields 
 Return comment reference

**Arguments:** `$0` **comment** (C)

### list
Return all comments for the given article target 
 as a JSON encoded list

**Arguments:** `$0` **target** (string)
