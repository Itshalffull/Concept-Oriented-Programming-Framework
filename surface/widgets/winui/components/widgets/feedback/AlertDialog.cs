// ============================================================
// Clef Surface WinUI Widget — AlertDialog
//
// Confirmation dialog that requires an explicit user action
// before it can be dismissed. Used for destructive operations
// and critical confirmations.
//
// Adapts the alert-dialog.widget spec to WinUI 3 ContentDialog.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefAlertDialog : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefAlertDialog),
            new PropertyMetadata(null));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefAlertDialog),
            new PropertyMetadata(null));

    public static readonly DependencyProperty CancelLabelProperty =
        DependencyProperty.Register(nameof(CancelLabel), typeof(string), typeof(ClefAlertDialog),
            new PropertyMetadata("Cancel"));

    public static readonly DependencyProperty ConfirmLabelProperty =
        DependencyProperty.Register(nameof(ConfirmLabel), typeof(string), typeof(ClefAlertDialog),
            new PropertyMetadata("Confirm"));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public string CancelLabel { get => (string)GetValue(CancelLabelProperty); set => SetValue(CancelLabelProperty, value); }
    public string ConfirmLabel { get => (string)GetValue(ConfirmLabelProperty); set => SetValue(ConfirmLabelProperty, value); }

    public event System.EventHandler Cancelled;
    public event System.EventHandler Confirmed;

    private ContentDialog _dialog;

    public ClefAlertDialog()
    {
        Content = new Grid();
    }

    public async void ShowDialog(XamlRoot xamlRoot)
    {
        _dialog = new ContentDialog
        {
            Title = Title,
            Content = new TextBlock { Text = Description ?? "", TextWrapping = TextWrapping.Wrap },
            PrimaryButtonText = ConfirmLabel,
            CloseButtonText = CancelLabel,
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = xamlRoot
        };

        var result = await _dialog.ShowAsync();
        if (result == ContentDialogResult.Primary)
            Confirmed?.Invoke(this, System.EventArgs.Empty);
        else
            Cancelled?.Invoke(this, System.EventArgs.Empty);
    }
}
