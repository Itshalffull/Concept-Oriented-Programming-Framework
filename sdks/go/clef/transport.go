package clef

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// ActionInvocation matches the Clef wire format for an incoming action.
type ActionInvocation struct {
	ID      string         `json:"id"`
	Concept string         `json:"concept"`
	Action  string         `json:"action"`
	Input   map[string]any `json:"input"`
	Flow    string         `json:"flow"`
}

// ActionCompletion matches the Clef wire format for an action result.
type ActionCompletion struct {
	ID        string         `json:"id"`
	Concept   string         `json:"concept"`
	Action    string         `json:"action"`
	Input     map[string]any `json:"input"`
	Variant   string         `json:"variant"`
	Output    map[string]any `json:"output"`
	Flow      string         `json:"flow"`
	Timestamp string         `json:"timestamp"`
}

// ConceptQuery matches the Clef wire format for a state query.
type ConceptQuery struct {
	Concept  string         `json:"concept"`
	Relation string         `json:"relation"`
	Args     map[string]any `json:"args"`
}

func handleInvoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var inv ActionInvocation
	if err := json.NewDecoder(r.Body).Decode(&inv); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if inv.ID == "" {
		inv.ID = uuid.New().String()
	}
	if inv.Flow == "" {
		inv.Flow = uuid.New().String()
	}

	entry, ok := registry[inv.Concept]
	if !ok {
		writeJSON(w, ActionCompletion{
			ID:        inv.ID,
			Concept:   inv.Concept,
			Action:    inv.Action,
			Input:     inv.Input,
			Variant:   "error",
			Output:    map[string]any{"variant": "error", "message": fmt.Sprintf("unknown concept: %s", inv.Concept)},
			Flow:      inv.Flow,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	result := entry.handler.Handle(inv.Action, inv.Input, entry.storage)
	variant, _ := result["variant"].(string)
	if variant == "" {
		variant = "ok"
	}

	writeJSON(w, ActionCompletion{
		ID:        inv.ID,
		Concept:   inv.Concept,
		Action:    inv.Action,
		Input:     inv.Input,
		Variant:   variant,
		Output:    result,
		Flow:      inv.Flow,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func handleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var q ConceptQuery
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entry, ok := registry[q.Concept]
	if !ok {
		writeJSON(w, []map[string]any{})
		return
	}

	results := entry.storage.Find(q.Relation, q.Args)
	if results == nil {
		results = []map[string]any{}
	}
	writeJSON(w, results)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"healthy": true, "latencyMs": 0})
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// Serve starts the HTTP transport server on the given address.
// All registered concept handlers are served.
//
// Routes:
//
//	POST /invoke → ActionInvocation handling
//	POST /query  → State queries
//	GET  /health → Health check
func Serve(addr string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/invoke", handleInvoke)
	mux.HandleFunc("/query", handleQuery)
	mux.HandleFunc("/health", handleHealth)

	fmt.Printf("Clef Go SDK v0.1.0\n")
	fmt.Printf("Serving %d concept(s) on %s\n", len(registry), addr)
	for uri := range registry {
		fmt.Printf("  - %s\n", uri)
	}

	log.Fatal(http.ListenAndServe(addr, mux))
}
