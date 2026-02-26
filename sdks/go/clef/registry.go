package clef

// registryEntry holds a handler and its associated storage.
type registryEntry struct {
	handler ConceptHandler
	storage Storage
}

// registry maps concept URIs to handler+storage pairs.
var registry = make(map[string]registryEntry)

// Register associates a concept URI with a handler and optional storage.
// If storage is nil, a new InMemoryStorage is created.
//
// Example:
//
//	clef.Register("urn:app/RateLimiter", &RateLimiterHandler{}, nil)
func Register(uri string, handler ConceptHandler, storage Storage) {
	if storage == nil {
		storage = NewInMemoryStorage()
	}
	registry[uri] = registryEntry{
		handler: handler,
		storage: storage,
	}
}
