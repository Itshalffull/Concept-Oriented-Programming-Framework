---
name: follow
description: Track follow relationships between users 
 Each user maintains a set of users they follow
argument-hint: [command] [user] [target]
---

# Follow

Track follow relationships between users 
 Each user maintains a set of users they follow

## Commands

### follow
Add target to user s following set 
 Return user and target references

**Arguments:** `$0` **user** (U), `$1` **target** (string)

### unfollow
Remove target from user s following set 
 Return user and target references

**Arguments:** `$0` **user** (U), `$1` **target** (string)

### isFollowing
Return whether the user follows the target

**Arguments:** `$0` **user** (U), `$1` **target** (string)
