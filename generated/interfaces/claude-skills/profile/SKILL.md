---
name: profile
description: Store and manage user profile information including 
 biography and avatar image Separate from User to 
 allow independent evolution and cross runtime replication
argument-hint: [command] [user] [bio] [image]
---

# Profile

Store and manage user profile information including 
 biography and avatar image Separate from User to 
 allow independent evolution and cross runtime replication

## Commands

### update
Store bio and image for the user Return updated fields

**Arguments:** `$0` **user** (U), `$1` **bio** (string), `$2` **image** (string)

### get
Return the profile for the given user

**Arguments:** `$0` **user** (U)
