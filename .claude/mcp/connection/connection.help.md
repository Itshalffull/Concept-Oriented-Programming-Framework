# connection — MCP Tool Guide

Establish and manage a session with a running Clef kernel instance , providing discovery , invocation , and observation of registered concepts . Transport agnostic : the same concept works over WebSocket , HTTP , IPC , or in process . Each connection carries a session identity that the kernel s existing auth concepts evaluate on every invocation

## Design Principles

- **Concepts Stay Independent:** External API bindings go through transport adapters and EffectHandler. Concept handlers use perform() — they never know about the external API directly.
- **Transport is Pluggable:** The same concept action can be served by different external APIs by swapping the transport adapter. No handler changes needed.
- **Credentials are Managed:** API keys, tokens, and secrets are stored in the Credential concept and injected by the transport adapter at runtime.
**map-to-concepts:**
- [ ] Each external endpoint maps to exactly one concept action?
- [ ] Input/output types are compatible?
- [ ] Error responses map to concept error variants?
- [ ] Authentication/authorization handled at transport level?

**configure-transport:**
- [ ] Base URL is configurable (not hardcoded)?
- [ ] Authentication credentials stored in Credential concept?
- [ ] Retry policy configured for transient failures?
- [ ] Rate limiting respected?
## References

- [Inbound API binding guide](references/inbound-binding-guide.md)
