// ============================================================
// Clef Surface WinUI Widget — Toast
//
// Ephemeral notification that appears briefly to communicate
// the result of an action. Supports info, success, warning,
// and error variants with optional action button.
//
// Adapts the toast.widget spec to WinUI 3 InfoBar used as
// a transient notification element.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefToast : UserControl
{
    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefToast),
            new PropertyMetadata("info", OnPropertyChanged));

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefToast),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefToast),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ActionLabelProperty =
        DependencyProperty.Register(nameof(ActionLabel), typeof(string), typeof(ClefToast),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public string ActionLabel { get => (string)GetValue(ActionLabelProperty); set => SetValue(ActionLabelProperty, value); }

    public event RoutedEventHandler Dismissed;
    public event RoutedEventHandler ActionClicked;

    private readonly InfoBar _infoBar;

    public ClefToast()
    {
        _infoBar = new InfoBar { IsOpen = true, IsClosable = true };
        _infoBar.CloseButtonClick += (s, e) => Dismissed?.Invoke(this, new RoutedEventArgs());
        Content = _infoBar;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefToast)d).UpdateVisual();

    private void UpdateVisual()
    {
        _infoBar.Title = Title;
        _infoBar.Message = Description ?? "";
        _infoBar.Severity = Variant switch
        {
            "success" => InfoBarSeverity.Success,
            "warning" => InfoBarSeverity.Warning,
            "error" => InfoBarSeverity.Error,
            _ => InfoBarSeverity.Informational
        };
        if (!string.IsNullOrEmpty(ActionLabel))
        {
            var btn = new Button { Content = ActionLabel };
            btn.Click += (s, e) => ActionClicked?.Invoke(this, e);
            _infoBar.ActionButton = btn;
        }
        else
        {
            _infoBar.ActionButton = null;
        }
    }
}
