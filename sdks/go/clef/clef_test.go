package clef

import (
	"testing"
)

// ============================================================
// Storage Tests
// ============================================================

func TestStoragePutAndGet(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "alice", map[string]any{"name": "Alice", "age": 30})
	val, ok := s.Get("users", "alice")
	if !ok {
		t.Fatal("expected to find alice")
	}
	if val["name"] != "Alice" {
		t.Errorf("expected name=Alice, got %v", val["name"])
	}
	if val["age"] != 30 {
		t.Errorf("expected age=30, got %v", val["age"])
	}
}

func TestStorageGetMissing(t *testing.T) {
	s := NewInMemoryStorage()
	_, ok := s.Get("users", "nonexistent")
	if ok {
		t.Error("expected not found")
	}
}

func TestStoragePutOverwrites(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "alice", map[string]any{"v": 1})
	s.Put("users", "alice", map[string]any{"v": 2})
	val, ok := s.Get("users", "alice")
	if !ok {
		t.Fatal("expected to find alice")
	}
	if val["v"] != 2 {
		t.Errorf("expected v=2, got %v", val["v"])
	}
}

func TestStorageDelete(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "alice", map[string]any{"name": "Alice"})
	deleted := s.Delete("users", "alice")
	if !deleted {
		t.Error("expected delete to return true")
	}
	_, ok := s.Get("users", "alice")
	if ok {
		t.Error("expected alice to be deleted")
	}
}

func TestStorageDeleteMissing(t *testing.T) {
	s := NewInMemoryStorage()
	deleted := s.Delete("users", "nonexistent")
	if deleted {
		t.Error("expected delete to return false for missing key")
	}
}

func TestStorageFindAll(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "alice", map[string]any{"name": "Alice", "role": "admin"})
	s.Put("users", "bob", map[string]any{"name": "Bob", "role": "user"})
	results := s.Find("users", nil)
	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}
}

func TestStorageFindWithFilter(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "alice", map[string]any{"name": "Alice", "role": "admin"})
	s.Put("users", "bob", map[string]any{"name": "Bob", "role": "user"})
	admins := s.Find("users", map[string]any{"role": "admin"})
	if len(admins) != 1 {
		t.Errorf("expected 1 admin, got %d", len(admins))
	}
	if admins[0]["name"] != "Alice" {
		t.Errorf("expected Alice, got %v", admins[0]["name"])
	}
}

func TestStorageFindEmpty(t *testing.T) {
	s := NewInMemoryStorage()
	results := s.Find("empty", nil)
	if results != nil && len(results) != 0 {
		t.Errorf("expected empty results, got %d", len(results))
	}
}

func TestStorageIsolatesRelations(t *testing.T) {
	s := NewInMemoryStorage()
	s.Put("users", "k1", map[string]any{"type": "user"})
	s.Put("posts", "k1", map[string]any{"type": "post"})
	users := s.Find("users", nil)
	posts := s.Find("posts", nil)
	if len(users) != 1 || users[0]["type"] != "user" {
		t.Error("users relation contaminated")
	}
	if len(posts) != 1 || posts[0]["type"] != "post" {
		t.Error("posts relation contaminated")
	}
}

// ============================================================
// Handler Tests
// ============================================================

type echoHandler struct{}

func (h *echoHandler) Handle(action string, input map[string]any, storage Storage) map[string]any {
	switch action {
	case "echo":
		msg, _ := input["message"].(string)
		return map[string]any{"variant": "ok", "message": msg}
	case "fail":
		return map[string]any{"variant": "error", "message": "intentional failure"}
	default:
		return map[string]any{"variant": "error", "message": "unknown action: " + action}
	}
}

func TestHandlerDispatch(t *testing.T) {
	h := &echoHandler{}
	s := NewInMemoryStorage()
	result := h.Handle("echo", map[string]any{"message": "hello"}, s)
	if result["variant"] != "ok" {
		t.Errorf("expected ok, got %v", result["variant"])
	}
	if result["message"] != "hello" {
		t.Errorf("expected hello, got %v", result["message"])
	}
}

func TestHandlerUnknownAction(t *testing.T) {
	h := &echoHandler{}
	s := NewInMemoryStorage()
	result := h.Handle("nonexistent", map[string]any{}, s)
	if result["variant"] != "error" {
		t.Error("expected error variant for unknown action")
	}
}

func TestHandlerErrorVariant(t *testing.T) {
	h := &echoHandler{}
	s := NewInMemoryStorage()
	result := h.Handle("fail", map[string]any{}, s)
	if result["variant"] != "error" {
		t.Error("expected error variant")
	}
	if result["message"] != "intentional failure" {
		t.Errorf("expected 'intentional failure', got %v", result["message"])
	}
}

// ============================================================
// Registry Tests
// ============================================================

func TestRegisterAndLookup(t *testing.T) {
	// Clear registry
	for k := range registry {
		delete(registry, k)
	}

	h := &echoHandler{}
	Register("urn:test/Echo", h, nil)

	entry, ok := registry["urn:test/Echo"]
	if !ok {
		t.Fatal("expected Echo to be registered")
	}
	if entry.handler != h {
		t.Error("registered handler doesn't match")
	}
	if entry.storage == nil {
		t.Error("expected auto-created storage")
	}
}

func TestRegisterWithCustomStorage(t *testing.T) {
	for k := range registry {
		delete(registry, k)
	}

	h := &echoHandler{}
	custom := NewInMemoryStorage()
	Register("urn:test/Custom", h, custom)

	entry := registry["urn:test/Custom"]
	if entry.storage != custom {
		t.Error("expected custom storage to be used")
	}
}
