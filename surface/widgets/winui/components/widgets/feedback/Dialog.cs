// ============================================================
// Clef Surface WinUI Widget — Dialog
//
// Modal overlay that captures focus and blocks interaction with
// the underlying content until dismissed. Supports a title bar,
// description, arbitrary body content, and close behavior.
//
// Adapts the dialog.widget spec to WinUI 3 ContentDialog.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefDialog : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefDialog),
            new PropertyMetadata(null));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefDialog),
            new PropertyMetadata(null));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }

    public event System.EventHandler DialogClosed;

    private ContentDialog _dialog;
    private UIElement _dialogContent;

    public ClefDialog()
    {
        Content = new Grid();
    }

    public void SetDialogContent(UIElement content)
    {
        _dialogContent = content;
    }

    public async void ShowDialog(XamlRoot xamlRoot)
    {
        var panel = new StackPanel { Spacing = 8 };
        if (!string.IsNullOrEmpty(Description))
            panel.Children.Add(new TextBlock { Text = Description, TextWrapping = TextWrapping.Wrap, Opacity = 0.7 });
        if (_dialogContent != null)
            panel.Children.Add(_dialogContent);

        _dialog = new ContentDialog
        {
            Title = Title,
            Content = panel,
            CloseButtonText = "Close",
            XamlRoot = xamlRoot
        };

        await _dialog.ShowAsync();
        DialogClosed?.Invoke(this, System.EventArgs.Empty);
    }
}
