# PRD: Encryption for Clef Base

## Problem

Clef Base stores all ContentNode data as plaintext. Applications handling
sensitive data (medical records, financial data, private messages) need
encryption at rest and optionally true E2EE where even the server operator
cannot read user data. There is no encryption concept in the framework.

## Two Approaches

### Approach A: Sync-based encryption (encrypt at rest)

Encryption happens via syncs that fire after ContentNode/create and before
ContentNode/get returns. Data is encrypted in storage, plaintext exists
briefly in handler memory. Configurable per-schema — apply an "Encrypted"
schema mixin to mark which ContentNodes get encrypted.

**Use cases:** Compliance (HIPAA, GDPR), database breach protection,
multi-tenant data isolation.

### Approach B: StorageProgram encryption transform (true E2EE)

Encryption happens as a StorageProgram transform — the program's `put`
instructions are rewritten to encrypt values before the interpreter runs
them, and `get` results are decrypted after. The interpreter and storage
adapter never see plaintext. Follows the same pattern as RenderProgram's
transform providers (token-remap, a11y-adapt, bind-rewrite).

**Use cases:** Zero-knowledge architectures, E2E encrypted messaging,
client-side encrypted notes.

---

## Shared: Encryption Concept (used by both approaches)

### S1. Encryption concept spec
- **File:** `repertoire/concepts/identity/encryption.concept`
- **What:** Key management + encrypt/decrypt operations. Actions:
  - `generateKeyPair(user, algorithm)` → ok(publicKey, keyId)
  - `encrypt(data, keyId)` → ok(ciphertext, iv, keyId)
  - `decrypt(ciphertext, iv, keyId)` → ok(plaintext)
  - `rotateKey(user)` → ok(newKeyId, newPublicKey)
  - `getPublicKey(user)` → ok(publicKey, keyId)
  - `listKeys(user)` → ok(keys)
  - `revokeKey(keyId)` → ok(keyId)
- **State:** keyPairs (set), publicKey, encryptedPrivateKey, algorithm,
  status (active/revoked), createdAt
- **Capabilities:** requires crypto

### S2. Encryption handler
- **File:** `handlers/ts/app/encryption.handler.ts`
- **What:** Functional handler using StorageProgram DSL. Uses Node.js
  `crypto` module for actual cryptographic operations:
  - `generateKeyPair`: crypto.generateKeyPairSync('x25519') for key exchange,
    crypto.randomBytes for symmetric keys
  - `encrypt`: crypto.createCipheriv('aes-256-gcm') with random IV
  - `decrypt`: crypto.createDecipheriv('aes-256-gcm')
  - Keys stored with private key encrypted by a master key (or user passphrase)

---

## Approach A: Sync-Based Encryption

### A1. Encrypted schema definition
- **File:** `clef-base/schemas/encrypted.schema.yaml`
- **What:** Schema mixin with fields: `encrypted` (Bool), `keyId` (String),
  `algorithm` (String, default "aes-256-gcm"), `encryptedFields` (list String,
  which fields to encrypt — default all). Applied to ContentNodes that need
  encryption.

### A2. Encrypt-on-write sync
- **File:** `syncs/identity/encrypt-on-write.sync`
- **What:** When ContentNode/create or ContentNode/update completes with ok,
  check if the node has the "Encrypted" schema applied. If so, invoke
  Encryption/encrypt on the content field and update the node with ciphertext.

### A3. Decrypt-on-read sync
- **File:** `syncs/identity/decrypt-on-read.sync`
- **What:** When ContentNode/get completes with ok, check if the node has
  the "Encrypted" schema. If so, invoke Encryption/decrypt on the content
  field and return plaintext to the caller.

### A4. Key provisioning sync
- **File:** `syncs/identity/provision-encryption-key.sync`
- **What:** When Schema/applyTo fires with schema "Encrypted", invoke
  Encryption/generateKeyPair for the node's owner (createdBy) if they
  don't have one yet, and store the keyId on the node.

---

## Approach B: StorageProgram Encryption Transform

### B1. StorageTransform concept spec
- **File:** `specs/monadic/storage-transform.concept`
- **What:** Registry and dispatcher for StorageProgram instruction rewrites,
  following the exact pattern of RenderTransform (specs/surface/render-transform.concept).
  Actions:
  - `registerKind(kind)` → register a transform kind
  - `register(name, kind, spec)` → register a named transform with config
  - `apply(program, kind, spec)` → rewrite program instructions per the spec
  - `compose(transforms)` → chain multiple transforms
  Kinds: "encrypt", "audit-log", "access-control" (extensible)

### B2. Encryption transform provider concept spec
- **File:** `specs/monadic/providers/encryption-transform-provider.concept`
- **What:** Provider that rewrites StorageProgram instructions:
  - `put` instructions → encrypt value fields before storage
  - `get` results → decrypt value fields after retrieval
  - `find` results → decrypt each record after retrieval
  - Configurable: which relations and fields to encrypt (from spec config)
  Actions:
  - `transform(program, config)` → ok(transformedProgram)

### B3. Encryption transform handler
- **File:** `handlers/ts/monadic/encryption-transform-provider.handler.ts`
- **What:** Walks the StorageProgram instruction list. For each `put`
  instruction targeting an encrypted relation, wraps the value in an
  Encryption/encrypt call. For each `get`/`find` result, inserts a
  `mapBindings` that calls Encryption/decrypt. The handler returns a
  new StorageProgram with the rewritten instructions.

### B4. Transform-before-execute sync
- **File:** `syncs/monadic/transform-before-execute.sync`
- **What:** Inserts between FunctionalHandler/build and ProgramInterpreter/execute.
  When a program is built, check if any registered StorageTransforms apply
  (based on the concept's encryption config), apply them in order, then
  hand the transformed program to the interpreter.
  ```
  FunctionalHandler/build → StorageTransform/apply → ProgramInterpreter/execute
  ```
  This replaces the direct BuildAndExecute sync for concepts with transforms.

### B5. Register encryption transform sync
- **File:** `syncs/monadic/register-encryption-transform.sync`
- **What:** On kernel boot, register the "encrypt" kind with StorageTransform
  and register the encryption-transform-provider.

---

## Traceability Matrix

Every PRD section maps to an exact implementation file and line range.

### Shared: Encryption Concept

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| S1. Concept spec | `repertoire/concepts/identity/encryption.concept` | 1-265 | 7 actions (generateKeyPair, encrypt, decrypt, getPublicKey, listKeys, rotateKey, revokeKey), key state with userId/algorithm/status/material, fixtures for all variants |
| S2. Handler: generateKeyPair | `handlers/ts/app/encryption.handler.ts` | 57-121 | Validates algorithm (aes-256-gcm/x25519/rsa-oaep), generates keys via crypto.randomBytes, stores with status "active" |
| S2. Handler: encrypt | `handlers/ts/app/encryption.handler.ts` | 123-179 | Validates data non-empty, checks key exists + not revoked, AES-256-GCM encryption with random IV, returns base64 ciphertext |
| S2. Handler: decrypt | `handlers/ts/app/encryption.handler.ts` | 181-222 | Checks key exists, AES-256-GCM decryption with IV, returns plaintext, invalid on failure |
| S2. Handler: getPublicKey | `handlers/ts/app/encryption.handler.ts` | 224-252 | Finds active keys for user via find + mapBindings filter, returns most recent |
| S2. Handler: listKeys | `handlers/ts/app/encryption.handler.ts` | 254-272 | Returns all keys (active + revoked) for user |
| S2. Handler: rotateKey | `handlers/ts/app/encryption.handler.ts` | 274-360 | Generates new key, revokes old key with replacedBy reference |
| S2. Handler: revokeKey | `handlers/ts/app/encryption.handler.ts` | 362-398 | Marks key as revoked with timestamp, checks not already revoked |
| S2. Conformance tests | `generated/tests/encryption.conformance.test.ts` | 1-815 | Generated from concept spec fixtures |

### Approach A: Sync-Based Encryption

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| A1. Encrypted schema | `clef-base/schemas/encrypted.schema.yaml` | 1-25 | Schema mixin with encrypted (Bool), keyId, algorithm (default aes-256-gcm), encryptedFields (default ["content"]) |
| A2. Encrypt-on-write | `syncs/identity/encrypt-on-write.sync` | 1-51 | EncryptContentOnCreate + EncryptContentOnUpdate syncs, guard on Encrypted schema membership |
| A3. Decrypt-on-read | `syncs/identity/decrypt-on-read.sync` | 1-21 | DecryptContentOnGet sync, guards on Encrypted schema, invokes Encryption/decrypt |
| A4. Key provisioning | `syncs/identity/provision-encryption-key.sync` | 1-23 | ProvisionKeyOnEncryptedSchema sync, fires on Schema/applyTo with "Encrypted", generates key pair |

### Approach B: StorageProgram Encryption Transform

| PRD Section | File | Lines | What was implemented |
|-------------|------|-------|---------------------|
| B1. StorageTransform concept | `specs/monadic/storage-transform.concept` | 1-216 | Mirrors RenderTransform: registerKind, register, apply, compose, list, get. Kinds: encrypt, audit-log, access-control. Functor laws. |
| B2. Encryption transform provider | `specs/monadic/providers/encryption-transform-provider.concept` | 1-128 | transform(program, config) rewrites put/get/find instructions. Config specifies relations + fields + keyId. |
| B3. Transform provider handler | — | — | Not yet implemented (concept spec only — handler follows after conformance tests are generated) |
| B4. Transform-before-execute sync | `syncs/monadic/transform-before-execute.sync` | 1-18 | Inserts between FunctionalHandler/build and ProgramInterpreter/execute |
| B5. Register encryption transform | `syncs/monadic/register-encryption-transform.sync` | 1-28 | RegisterEncryptionKind + RegisterEncryptionProvider syncs on kernel boot |
