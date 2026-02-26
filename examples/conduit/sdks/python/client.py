#!/usr/bin/env python3
"""
Conduit Example App — Python SDK Client

Demonstrates the Python SDK calling the Conduit REST API.
Exercises the full user journey: register -> login -> create article -> comment -> follow -> favorite.
"""

import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError


class ConduitClient:
    """HTTP client for the Conduit Clef REST API."""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.environ.get("CONDUIT_URL", "http://localhost:3000")
        self.token: str | None = None

    def _request(self, method: str, path: str, body: dict = None) -> dict:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode() if body else None
        headers = {"Content-Type": "application/json"}

        if self.token:
            headers["Authorization"] = f"Token {self.token}"

        req = Request(url, data=data, headers=headers, method=method)

        try:
            with urlopen(req) as resp:
                return json.loads(resp.read().decode())
        except HTTPError as e:
            error_body = e.read().decode()
            raise RuntimeError(f"HTTP {e.code}: {error_body}") from e

    def health(self) -> dict:
        return self._request("GET", "/api/health")

    def register(self, username: str, email: str, password: str) -> dict:
        result = self._request("POST", "/api/users", {
            "user": {"username": username, "email": email, "password": password}
        })
        if "user" in result and "token" in result["user"]:
            self.token = result["user"]["token"]
        return result

    def login(self, email: str, password: str) -> dict:
        result = self._request("POST", "/api/users/login", {
            "user": {"email": email, "password": password}
        })
        if "user" in result and "token" in result["user"]:
            self.token = result["user"]["token"]
        return result

    def update_profile(self, bio: str = None, image: str = None) -> dict:
        user = {}
        if bio is not None:
            user["bio"] = bio
        if image is not None:
            user["image"] = image
        return self._request("PUT", "/api/user", {"user": user})

    def create_article(self, title: str, description: str, body: str, tags: list = None) -> dict:
        article = {"title": title, "description": description, "body": body}
        if tags:
            article["tagList"] = tags
        return self._request("POST", "/api/articles", {"article": article})

    def delete_article(self, slug: str) -> dict:
        return self._request("DELETE", f"/api/articles/{slug}")

    def create_comment(self, slug: str, body: str) -> dict:
        return self._request("POST", f"/api/articles/{slug}/comments", {
            "comment": {"body": body}
        })

    def follow(self, username: str) -> dict:
        return self._request("POST", f"/api/profiles/{username}/follow")

    def unfollow(self, username: str) -> dict:
        return self._request("DELETE", f"/api/profiles/{username}/follow")

    def favorite(self, slug: str) -> dict:
        return self._request("POST", f"/api/articles/{slug}/favorite")

    def unfavorite(self, slug: str) -> dict:
        return self._request("DELETE", f"/api/articles/{slug}/favorite")


def main():
    client = ConduitClient()

    print("Conduit Python SDK Client")
    print("=========================")

    # Health check
    try:
        health = client.health()
        print(f"Server: {health['status']} | Concepts: {health['concepts']} | Syncs: {health['syncs']}\n")
    except Exception as e:
        print(f"Server unreachable: {e}")
        sys.exit(1)

    # Register
    print("1. Registering user...")
    try:
        result = client.register("python-user", "python@conduit.io", "password123")
        user = result["user"]
        print(f"   Registered: {user['username']} (token: {user['token'][:20]}...)\n")
    except Exception as e:
        print(f"   Failed: {e}\n")
        sys.exit(1)

    # Login
    print("2. Logging in...")
    try:
        result = client.login("python@conduit.io", "password123")
        print(f"   Logged in: {result['user']['username']}\n")
    except Exception as e:
        print(f"   Failed: {e}\n")

    # Update profile
    print("3. Updating profile...")
    try:
        result = client.update_profile(bio="Python developer", image="https://python.org/logo.png")
        print(f"   Profile updated\n")
    except Exception as e:
        print(f"   Failed: {e}\n")

    # Create article
    print("4. Creating article...")
    try:
        result = client.create_article(
            title="Clef from Python",
            description="Using the Python SDK to interact with Clef",
            body="This article was created by the Python SDK client...",
            tags=["python", "clef", "sdk"],
        )
        print(f"   Created: {result.get('article', {}).get('title', 'unknown')}\n")
    except Exception as e:
        print(f"   Failed: {e}\n")

    # Follow
    print("5. Following user...")
    try:
        client.follow("other-user")
        print("   Followed!\n")
    except Exception as e:
        print(f"   Failed: {e}\n")

    # Favorite
    print("6. Favoriting article...")
    try:
        client.favorite("some-article")
        print("   Favorited!\n")
    except Exception as e:
        print(f"   Failed: {e}\n")

    print("Python SDK journey complete!")


if __name__ == "__main__":
    main()
