---
name: article
description: Manage articles with title , description , body , and author 
 Each article is an independent content entity
argument-hint: [command] [article] [title] [description] [body] [author]
---

# Article

Manage articles with title , description , body , and author 
 Each article is an independent content entity

## Commands

### create
Add article to set Store all fields Generate slug from title 
 Set createdAt and updatedAt timestamps Return article reference

**Arguments:** `$0` **article** (A), `$1` **title** (string), `$2` **description** (string), `$3` **body** (string), `$4` **author** (string)

### update
Update article fields and updatedAt timestamp Return article reference

**Arguments:** `$0` **article** (A), `$1` **title** (string), `$2` **description** (string), `$3` **body** (string)

### delete
Remove article from set Delete all fields Return article reference

**Arguments:** `$0` **article** (A)

### get
Return all fields for the article

**Arguments:** `$0` **article** (A)

### list
Return all articles as a JSON encoded list
