// Conduit Example App -- WinUI Login Page Code-Behind
// Handles email/password login and registration form submission.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using ConduitApp.Services;

namespace ConduitApp.Pages;

public sealed partial class LoginPage : Page
{
    public LoginPage()
    {
        InitializeComponent();
    }

    private async void OnLoginClick(object sender, RoutedEventArgs e)
    {
        var email = EmailBox.Text.Trim();
        var password = PasswordBox.Password;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            ShowError("Email and password are required.");
            return;
        }

        SetLoading(true);

        try
        {
            await ApiClient.Instance.LoginAsync(email, password);
            NavigateBack();
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            SetLoading(false);
        }
    }

    private async void OnRegisterClick(object sender, RoutedEventArgs e)
    {
        var email = EmailBox.Text.Trim();
        var password = PasswordBox.Password;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            ShowError("Email and password are required.");
            return;
        }

        var username = email.Split('@')[0];
        SetLoading(true);

        try
        {
            await ApiClient.Instance.RegisterAsync(username, email, password);
            NavigateBack();
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            SetLoading(false);
        }
    }

    private void SetLoading(bool isLoading)
    {
        LoadingRing.IsActive = isLoading;
        LoadingRing.Visibility = isLoading ? Visibility.Visible : Visibility.Collapsed;
        EmailBox.IsEnabled = !isLoading;
        PasswordBox.IsEnabled = !isLoading;
    }

    private void ShowError(string message)
    {
        ErrorBar.Message = message;
        ErrorBar.IsOpen = true;
    }

    private void NavigateBack()
    {
        // Navigate back to home via the main window
        if (this.XamlRoot?.Content is MainWindow mainWindow)
        {
            mainWindow.OnLoginSuccess();
        }
        else if (Frame.CanGoBack)
        {
            Frame.GoBack();
        }
    }
}
