---
name: jwt
description: Generate and verify JSON Web Tokens for user sessions
argument-hint: [command] [user]
---

# JWT

Generate and verify JSON Web Tokens for user sessions

## Commands

### generate
Create a JWT containing the user reference Store and return it

**Arguments:** `$0` **user** (U)

### verify
Decode the token Return the user reference

**Arguments:** `$0` **token** (string)
