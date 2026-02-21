// Conduit Example App -- WinUI Home Page Code-Behind
// Loads and displays the article feed, handles navigation to article detail.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using ConduitApp.Models;
using ConduitApp.Services;
using System.Collections.ObjectModel;

namespace ConduitApp.Pages;

public class ArticleViewModel
{
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Body { get; set; } = "";
    public Profile Author { get; set; } = new Profile("", null, null, false);
    public int FavoritesCount { get; set; }
    public string CreatedAtDisplay { get; set; } = "";
    public bool Favorited { get; set; }
    public string[] TagList { get; set; } = [];

    public static ArticleViewModel FromArticle(Article article) => new()
    {
        Slug = article.Slug,
        Title = article.Title,
        Description = article.Description,
        Body = article.Body,
        Author = article.Author,
        FavoritesCount = article.FavoritesCount,
        Favorited = article.Favorited,
        TagList = article.TagList,
        CreatedAtDisplay = article.CreatedAt.Length >= 10 ? article.CreatedAt[..10] : article.CreatedAt
    };
}

public sealed partial class HomePage : Page
{
    private readonly ObservableCollection<ArticleViewModel> _articles = new();

    public HomePage()
    {
        InitializeComponent();
        ArticleList.ItemsSource = _articles;
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        await LoadArticlesAsync();
    }

    private async Task LoadArticlesAsync()
    {
        LoadingRing.IsActive = true;
        LoadingRing.Visibility = Visibility.Visible;
        ArticleList.Visibility = Visibility.Collapsed;
        ErrorPanel.Visibility = Visibility.Collapsed;

        try
        {
            var articles = await ApiClient.Instance.GetArticlesAsync();
            _articles.Clear();
            foreach (var article in articles)
            {
                _articles.Add(ArticleViewModel.FromArticle(article));
            }

            LoadingRing.IsActive = false;
            LoadingRing.Visibility = Visibility.Collapsed;
            ArticleList.Visibility = Visibility.Visible;
        }
        catch (Exception ex)
        {
            LoadingRing.IsActive = false;
            LoadingRing.Visibility = Visibility.Collapsed;
            ErrorText.Text = ex.Message;
            ErrorPanel.Visibility = Visibility.Visible;
        }
    }

    private void OnRetryClick(object sender, RoutedEventArgs e)
    {
        _ = LoadArticlesAsync();
    }

    private void OnArticleSelected(object sender, SelectionChangedEventArgs e)
    {
        if (ArticleList.SelectedItem is ArticleViewModel vm)
        {
            // Navigate to article detail -- in a real app this would navigate to an ArticlePage
            // For now, show article content in a ContentDialog
            ShowArticleDialog(vm);
            ArticleList.SelectedItem = null;
        }
    }

    private async void ShowArticleDialog(ArticleViewModel article)
    {
        var dialog = new ContentDialog
        {
            Title = article.Title,
            Content = new ScrollViewer
            {
                Content = new StackPanel
                {
                    Spacing = 8,
                    Children =
                    {
                        new TextBlock
                        {
                            Text = $"By {article.Author.Username}",
                            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                                Microsoft.UI.Colors.ForestGreen),
                            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold
                        },
                        new TextBlock
                        {
                            Text = article.Body,
                            TextWrapping = TextWrapping.Wrap
                        },
                        new TextBlock
                        {
                            Text = article.TagList.Length > 0
                                ? $"Tags: {string.Join(", ", article.TagList)}"
                                : "",
                            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                                Microsoft.UI.Colors.Gray),
                            FontSize = 11
                        }
                    }
                },
                MaxHeight = 400
            },
            CloseButtonText = "Close",
            XamlRoot = this.XamlRoot
        };

        await dialog.ShowAsync();
    }
}
