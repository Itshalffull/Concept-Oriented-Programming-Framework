# Walkthrough: Creating a Kit

This walkthrough shows how to create, validate, and test
a reusable concept kit.

## Step 1: Scaffold

```bash
copf kit init auth-kit
```

Creates:
```
auth-kit/
├── kit.yaml
├── concepts/
│   └── example.concept
├── syncs/
└── tests/
```

## Step 2: Add Concepts

Move your concept specs into `concepts/`:

```bash
cp specs/user.concept auth-kit/concepts/
cp specs/password.concept auth-kit/concepts/
cp specs/session.concept auth-kit/concepts/
```

## Step 3: Update kit.yaml

```yaml
kit:
  name: auth
  version: 1.0.0
  description: Authentication and identity management

concepts:
  - concepts/user.concept
  - concepts/password.concept
  - concepts/session.concept

syncs:
  required:
    - syncs/validate-session.sync
```

## Step 4: Validate and Test

```bash
copf kit validate ./auth-kit
copf kit test ./auth-kit
```
