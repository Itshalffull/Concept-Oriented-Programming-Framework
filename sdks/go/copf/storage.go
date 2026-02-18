package copf

import (
	"sync"
	"time"
)

// Storage is the concept storage interface. Each concept gets its own
// isolated storage instance, organized by relation.
// Matches the TypeScript ConceptStorage interface (Section 6.8).
type Storage interface {
	Get(relation, key string) (map[string]any, bool)
	Put(relation, key string, value map[string]any)
	Delete(relation, key string) bool
	Find(relation string, args map[string]any) []map[string]any
}

// InMemoryStorage is a thread-safe in-memory Storage implementation.
type InMemoryStorage struct {
	mu        sync.RWMutex
	relations map[string]map[string]entry
}

type entry struct {
	Value       map[string]any
	LastWritten time.Time
}

// NewInMemoryStorage creates a new empty in-memory storage.
func NewInMemoryStorage() *InMemoryStorage {
	return &InMemoryStorage{
		relations: make(map[string]map[string]entry),
	}
}

func (s *InMemoryStorage) ensureRelation(relation string) map[string]entry {
	if _, ok := s.relations[relation]; !ok {
		s.relations[relation] = make(map[string]entry)
	}
	return s.relations[relation]
}

func (s *InMemoryStorage) Get(relation, key string) (map[string]any, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rel := s.ensureRelation(relation)
	e, ok := rel[key]
	if !ok {
		return nil, false
	}
	return e.Value, true
}

func (s *InMemoryStorage) Put(relation, key string, value map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rel := s.ensureRelation(relation)
	rel[key] = entry{
		Value:       value,
		LastWritten: time.Now(),
	}
}

func (s *InMemoryStorage) Delete(relation, key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	rel := s.ensureRelation(relation)
	if _, ok := rel[key]; ok {
		delete(rel, key)
		return true
	}
	return false
}

func (s *InMemoryStorage) Find(relation string, args map[string]any) []map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rel := s.ensureRelation(relation)
	var results []map[string]any

	for _, e := range rel {
		if matchesArgs(e.Value, args) {
			results = append(results, e.Value)
		}
	}
	return results
}

func matchesArgs(value, args map[string]any) bool {
	if args == nil {
		return true
	}
	for k, v := range args {
		if value[k] != v {
			return false
		}
	}
	return true
}
