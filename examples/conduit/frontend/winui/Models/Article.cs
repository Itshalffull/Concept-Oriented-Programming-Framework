// Conduit Example App -- WinUI Data Models
// C# record types matching the Conduit REST API response structures.

using System.Text.Json.Serialization;

namespace ConduitApp.Models;

public record User(
    [property: JsonPropertyName("username")] string Username,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("bio")] string? Bio = null,
    [property: JsonPropertyName("image")] string? Image = null
);

public record Profile(
    [property: JsonPropertyName("username")] string Username,
    [property: JsonPropertyName("bio")] string? Bio = null,
    [property: JsonPropertyName("image")] string? Image = null,
    [property: JsonPropertyName("following")] bool Following = false
);

public record Article(
    [property: JsonPropertyName("slug")] string Slug,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("tagList")] string[] TagList,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("updatedAt")] string UpdatedAt,
    [property: JsonPropertyName("favorited")] bool Favorited,
    [property: JsonPropertyName("favoritesCount")] int FavoritesCount,
    [property: JsonPropertyName("author")] Profile Author
);

public record Comment(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("author")] Profile Author
);

// Response wrappers
public record UserResponse([property: JsonPropertyName("user")] User User);
public record ProfileResponse([property: JsonPropertyName("profile")] Profile Profile);
public record ArticleResponse([property: JsonPropertyName("article")] Article Article);
public record ArticlesResponse(
    [property: JsonPropertyName("articles")] Article[] Articles,
    [property: JsonPropertyName("articlesCount")] int ArticlesCount
);
public record CommentResponse([property: JsonPropertyName("comment")] Comment Comment);
public record CommentsResponse([property: JsonPropertyName("comments")] Comment[] Comments);
public record TagsResponse([property: JsonPropertyName("tags")] string[] Tags);

// Error response
public record ErrorBody([property: JsonPropertyName("body")] string[] Body);
public record ErrorResponse([property: JsonPropertyName("errors")] ErrorBody Errors);
