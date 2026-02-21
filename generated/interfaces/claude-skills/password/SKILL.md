---
name: password
description: Securely store and validate user credentials using 
 salted hashing Does not handle reset flows those 
 are composed via synchronization with a token concept
argument-hint: [command] [user] [password]
---

# Password

Securely store and validate user credentials using 
 salted hashing Does not handle reset flows those 
 are composed via synchronization with a token concept

## Commands

### set
Generate a random salt Hash the password with the salt 
 Store both Return the user reference

**Arguments:** `$0` **user** (U), `$1` **password** (string)

### check
Retrieve the salt for the user Hash the provided 
 password with it Return true if hashes match

**Arguments:** `$0` **user** (U), `$1` **password** (string)

### validate
Check that the password meets strength requirements 
 without storing anything

**Arguments:** `$0` **password** (string)
