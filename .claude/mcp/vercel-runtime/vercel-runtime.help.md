# vercel_runtime — MCP Tool Guide

Manage Vercel project deployments . Owns project configurations , deployment URLs , edge regions , and serverless function settings

**provision:**
- [ ] VERCEL_TOKEN environment variable set?
- [ ] VERCEL_TEAM_ID set (if using team scope)?
- [ ] Project name is URL-safe?

**deploy:**
- [ ] Source directory exists and contains package.json?
- [ ] next build succeeds locally?
