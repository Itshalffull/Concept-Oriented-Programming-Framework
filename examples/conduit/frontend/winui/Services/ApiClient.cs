// Conduit Example App -- WinUI API Client
// HttpClient-based wrapper for the Conduit REST API.

using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ConduitApp.Models;

namespace ConduitApp.Services;

public class ApiClient
{
    private static readonly ApiClient _instance = new();
    public static ApiClient Instance => _instance;

    private const string BaseUrl = "http://localhost:3000";
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions;

    public string? Token { get; private set; }
    public User? CurrentUser { get; private set; }
    public bool IsAuthenticated => Token != null;

    private ApiClient()
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(BaseUrl) };
        _jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    }

    private void SetAuthHeader()
    {
        if (Token != null)
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Token", Token);
        }
        else
        {
            _httpClient.DefaultRequestHeaders.Authorization = null;
        }
    }

    private async Task<T> RequestAsync<T>(HttpMethod method, string path, object? body = null)
    {
        SetAuthHeader();

        var request = new HttpRequestMessage(method, path);
        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, _jsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        var response = await _httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            try
            {
                var errorRes = JsonSerializer.Deserialize<ErrorResponse>(errorContent, _jsonOptions);
                throw new Exception(string.Join(", ", errorRes?.Errors?.Body ?? ["Unknown error"]));
            }
            catch (JsonException)
            {
                throw new Exception($"HTTP {(int)response.StatusCode}: {errorContent}");
            }
        }

        var result = await response.Content.ReadFromJsonAsync<T>(_jsonOptions);
        return result ?? throw new Exception("Empty response body");
    }

    // Auth
    public async Task<User> LoginAsync(string email, string password)
    {
        var body = new { user = new { email, password } };
        var res = await RequestAsync<UserResponse>(HttpMethod.Post, "/api/users/login", body);
        Token = res.User.Token;
        CurrentUser = res.User;
        return res.User;
    }

    public async Task<User> RegisterAsync(string username, string email, string password)
    {
        var body = new { user = new { username, email, password } };
        var res = await RequestAsync<UserResponse>(HttpMethod.Post, "/api/users", body);
        Token = res.User.Token;
        CurrentUser = res.User;
        return res.User;
    }

    public void Logout()
    {
        Token = null;
        CurrentUser = null;
    }

    // Profile
    public async Task<Profile> GetProfileAsync(string username)
    {
        var res = await RequestAsync<ProfileResponse>(HttpMethod.Get, $"/api/profiles/{username}");
        return res.Profile;
    }

    // Articles
    public async Task<Article[]> GetArticlesAsync()
    {
        var res = await RequestAsync<ArticlesResponse>(HttpMethod.Get, "/api/articles");
        return res.Articles;
    }

    public async Task<Article> GetArticleAsync(string slug)
    {
        var res = await RequestAsync<ArticleResponse>(HttpMethod.Get, $"/api/articles/{slug}");
        return res.Article;
    }

    public async Task<Article> CreateArticleAsync(string title, string description, string body, string[]? tagList = null)
    {
        var reqBody = new { article = new { title, description, body, tagList } };
        var res = await RequestAsync<ArticleResponse>(HttpMethod.Post, "/api/articles", reqBody);
        return res.Article;
    }

    public async Task DeleteArticleAsync(string slug)
    {
        await RequestAsync<object>(HttpMethod.Delete, $"/api/articles/{slug}");
    }

    // Comments
    public async Task<Comment[]> GetCommentsAsync(string slug)
    {
        var res = await RequestAsync<CommentsResponse>(HttpMethod.Get, $"/api/articles/{slug}/comments");
        return res.Comments;
    }

    public async Task<Comment> CreateCommentAsync(string slug, string body)
    {
        var reqBody = new { comment = new { body } };
        var res = await RequestAsync<CommentResponse>(HttpMethod.Post, $"/api/articles/{slug}/comments", reqBody);
        return res.Comment;
    }

    // Social
    public async Task<Profile> FollowAsync(string username)
    {
        var res = await RequestAsync<ProfileResponse>(HttpMethod.Post, $"/api/profiles/{username}/follow");
        return res.Profile;
    }

    public async Task<Profile> UnfollowAsync(string username)
    {
        var res = await RequestAsync<ProfileResponse>(HttpMethod.Delete, $"/api/profiles/{username}/follow");
        return res.Profile;
    }

    public async Task<Article> FavoriteAsync(string slug)
    {
        var res = await RequestAsync<ArticleResponse>(HttpMethod.Post, $"/api/articles/{slug}/favorite");
        return res.Article;
    }

    public async Task<Article> UnfavoriteAsync(string slug)
    {
        var res = await RequestAsync<ArticleResponse>(HttpMethod.Delete, $"/api/articles/{slug}/favorite");
        return res.Article;
    }

    // Tags
    public async Task<string[]> GetTagsAsync()
    {
        var res = await RequestAsync<TagsResponse>(HttpMethod.Get, "/api/tags");
        return res.Tags;
    }
}
