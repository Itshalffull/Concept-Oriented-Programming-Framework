// Conduit Example App -- WinUI Main Window Code-Behind
// NavigationView host with Frame-based page navigation.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using ConduitApp.Pages;
using ConduitApp.Services;

namespace ConduitApp;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Title = "Conduit";

        // Navigate to home page on startup
        ContentFrame.Navigate(typeof(HomePage));
    }

    private void NavView_ItemInvoked(NavigationView sender, NavigationViewItemInvokedEventArgs args)
    {
        var tag = (args.InvokedItemContainer as NavigationViewItem)?.Tag?.ToString();

        switch (tag)
        {
            case "Home":
                ContentFrame.Navigate(typeof(HomePage));
                break;
            case "Login":
                if (ApiClient.Instance.IsAuthenticated)
                {
                    ApiClient.Instance.Logout();
                    LoginNavItem.Content = "Sign In";
                    ContentFrame.Navigate(typeof(HomePage));
                }
                else
                {
                    ContentFrame.Navigate(typeof(LoginPage));
                }
                break;
        }
    }

    private void NavView_BackRequested(NavigationView sender, NavigationViewBackRequestedEventArgs args)
    {
        if (ContentFrame.CanGoBack)
        {
            ContentFrame.GoBack();
        }
    }

    public void NavigateToArticle(string slug)
    {
        ContentFrame.Navigate(typeof(HomePage), slug);
    }

    public void OnLoginSuccess()
    {
        LoginNavItem.Content = ApiClient.Instance.CurrentUser?.Username ?? "Account";
        ContentFrame.Navigate(typeof(HomePage));
    }
}
