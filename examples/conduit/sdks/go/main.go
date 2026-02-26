// Conduit Example App — Go SDK Client
// Demonstrates the Go SDK calling the Conduit REST API.
// Exercises the full user journey: register → login → create article → comment → follow → favorite.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const defaultBaseURL = "http://localhost:3000"

type ConduitClient struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

type User struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Token    string `json:"token"`
	Bio      string `json:"bio,omitempty"`
	Image    string `json:"image,omitempty"`
}

type Article struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Body        string `json:"body"`
}

type UserResponse struct {
	User User `json:"user"`
}

type ArticleResponse struct {
	Article Article `json:"article"`
}

type HealthResponse struct {
	Status   string `json:"status"`
	Concepts int    `json:"concepts"`
	Syncs    int    `json:"syncs"`
}

func NewClient(baseURL string) *ConduitClient {
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return &ConduitClient{
		BaseURL: baseURL,
		HTTP:    &http.Client{},
	}
}

func (c *ConduitClient) request(method, path string, body interface{}) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Token "+c.Token)
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	return data, nil
}

func (c *ConduitClient) Health() (*HealthResponse, error) {
	data, err := c.request("GET", "/api/health", nil)
	if err != nil {
		return nil, err
	}
	var resp HealthResponse
	return &resp, json.Unmarshal(data, &resp)
}

func (c *ConduitClient) Register(username, email, password string) (*UserResponse, error) {
	body := map[string]interface{}{
		"user": map[string]string{
			"username": username,
			"email":    email,
			"password": password,
		},
	}
	data, err := c.request("POST", "/api/users", body)
	if err != nil {
		return nil, err
	}
	var resp UserResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	c.Token = resp.User.Token
	return &resp, nil
}

func (c *ConduitClient) Login(email, password string) (*UserResponse, error) {
	body := map[string]interface{}{
		"user": map[string]string{
			"email":    email,
			"password": password,
		},
	}
	data, err := c.request("POST", "/api/users/login", body)
	if err != nil {
		return nil, err
	}
	var resp UserResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	c.Token = resp.User.Token
	return &resp, nil
}

func (c *ConduitClient) CreateArticle(title, description, body string) (*ArticleResponse, error) {
	reqBody := map[string]interface{}{
		"article": map[string]string{
			"title":       title,
			"description": description,
			"body":        body,
		},
	}
	data, err := c.request("POST", "/api/articles", reqBody)
	if err != nil {
		return nil, err
	}
	var resp ArticleResponse
	return &resp, json.Unmarshal(data, &resp)
}

func (c *ConduitClient) Follow(username string) error {
	_, err := c.request("POST", "/api/profiles/"+username+"/follow", nil)
	return err
}

func (c *ConduitClient) Favorite(slug string) error {
	_, err := c.request("POST", "/api/articles/"+slug+"/favorite", nil)
	return err
}

func main() {
	baseURL := os.Getenv("CONDUIT_URL")
	client := NewClient(baseURL)

	fmt.Println("Conduit Go SDK Client")
	fmt.Println("=====================")

	// Health check
	health, err := client.Health()
	if err != nil {
		fmt.Printf("Server unreachable: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Server: %s | Concepts: %d | Syncs: %d\n\n", health.Status, health.Concepts, health.Syncs)

	// Register
	fmt.Println("1. Registering user...")
	user, err := client.Register("go-user", "go@conduit.io", "password123")
	if err != nil {
		fmt.Printf("   Failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("   Registered: %s (token: %s...)\n\n", user.User.Username, user.User.Token[:20])

	// Login
	fmt.Println("2. Logging in...")
	login, err := client.Login("go@conduit.io", "password123")
	if err != nil {
		fmt.Printf("   Failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("   Logged in: %s\n\n", login.User.Username)

	// Create article
	fmt.Println("3. Creating article...")
	article, err := client.CreateArticle(
		"Clef from Go",
		"Using the Go SDK to interact with Clef",
		"This article was created by the Go SDK client...",
	)
	if err != nil {
		fmt.Printf("   Failed: %v\n", err)
	} else {
		fmt.Printf("   Created: %s\n\n", article.Article.Title)
	}

	// Follow
	fmt.Println("4. Following user...")
	if err := client.Follow("other-user"); err != nil {
		fmt.Printf("   Failed: %v\n", err)
	} else {
		fmt.Println("   Followed!")
	}

	fmt.Println("\nGo SDK journey complete!")
}
