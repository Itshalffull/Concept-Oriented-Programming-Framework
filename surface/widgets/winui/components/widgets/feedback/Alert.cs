// ============================================================
// Clef Surface WinUI Widget — Alert
//
// Inline, persistent status message with icon, title, optional
// description, and an optional close button. Supports info,
// success, warning, and error variants.
//
// Adapts the alert.widget spec to WinUI 3 InfoBar control.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Feedback;

public sealed class ClefAlert : UserControl
{
    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefAlert),
            new PropertyMetadata("info", OnPropertyChanged));

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefAlert),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefAlert),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsClosableProperty =
        DependencyProperty.Register(nameof(IsClosable), typeof(bool), typeof(ClefAlert),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }
    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public bool IsClosable { get => (bool)GetValue(IsClosableProperty); set => SetValue(IsClosableProperty, value); }

    public event RoutedEventHandler Closed;

    private readonly InfoBar _infoBar;

    public ClefAlert()
    {
        _infoBar = new InfoBar { IsOpen = true };
        _infoBar.CloseButtonClick += (s, e) => Closed?.Invoke(this, new RoutedEventArgs());
        Content = _infoBar;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefAlert)d).UpdateVisual();

    private void UpdateVisual()
    {
        _infoBar.Title = Title ?? "";
        _infoBar.Message = Description ?? "";
        _infoBar.IsClosable = IsClosable;
        _infoBar.Severity = Variant switch
        {
            "warning" => InfoBarSeverity.Warning,
            "error" => InfoBarSeverity.Error,
            "success" => InfoBarSeverity.Success,
            _ => InfoBarSeverity.Informational
        };
    }
}
