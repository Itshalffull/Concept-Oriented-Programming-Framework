---
name: favorite
description: Track which articles a user has favorited 
 Each user maintains a set of favorited article references
argument-hint: [command] [user] [article]
---

# Favorite

Track which articles a user has favorited 
 Each user maintains a set of favorited article references

## Commands

### favorite
Add article to user s favorites set 
 Return user and article references

**Arguments:** `$0` **user** (U), `$1` **article** (string)

### unfavorite
Remove article from user s favorites set 
 Return user and article references

**Arguments:** `$0` **user** (U), `$1` **article** (string)

### isFavorited
Return whether the article is in the user s favorites

**Arguments:** `$0` **user** (U), `$1` **article** (string)

### count
Return the number of users who favorited this article

**Arguments:** `$0` **article** (string)
