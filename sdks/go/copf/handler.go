// Package copf implements the COPF concept handler protocol for Go.
//
// This is a thin protocol library (~300 LOC total), NOT a code generator.
// It lets Go developers write concept handlers that communicate with the
// COPF sync engine over HTTP.
//
// Target: infrastructure concepts behind HTTP transport.
//
// Usage:
//
//	type RateLimiterHandler struct{}
//
//	func (h *RateLimiterHandler) Handle(action string, input map[string]any, storage copf.Storage) map[string]any {
//	    switch action {
//	    case "check":
//	        key := input["key"].(string)
//	        // ... rate limiting logic ...
//	        return map[string]any{"variant": "ok", "remaining": 99}
//	    default:
//	        return map[string]any{"variant": "error", "message": "unknown action: " + action}
//	    }
//	}
//
//	func main() {
//	    copf.Register("urn:app/RateLimiter", &RateLimiterHandler{}, nil)
//	    copf.Serve(":8091")
//	}
//
// Architecture (Section 16.13):
//
//	SDKs are pre-conceptual protocol libraries. They don't generate code,
//	don't use ConceptManifest, and don't integrate with the compiler pipeline.
package copf

// ConceptHandler is the interface that concept handler implementations must satisfy.
// Each action method receives the action name, input fields, and a storage instance.
type ConceptHandler interface {
	// Handle dispatches an action invocation and returns a completion.
	// The returned map must contain at minimum a "variant" key.
	Handle(action string, input map[string]any, storage Storage) map[string]any
}
