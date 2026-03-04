// ============================================================
// Clef Surface WinUI Widget — Disclosure
//
// Toggleable content visibility control. A single collapsible
// section with a summary label. Maps the disclosure.widget
// spec to WinUI 3 Expander.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefDisclosure : UserControl
{
    public static readonly DependencyProperty HeaderTextProperty =
        DependencyProperty.Register(nameof(HeaderText), typeof(string), typeof(ClefDisclosure),
            new PropertyMetadata("Details", OnPropertyChanged));

    public static readonly DependencyProperty IsExpandedProperty =
        DependencyProperty.Register(nameof(IsExpanded), typeof(bool), typeof(ClefDisclosure),
            new PropertyMetadata(false, OnPropertyChanged));

    public string HeaderText { get => (string)GetValue(HeaderTextProperty); set => SetValue(HeaderTextProperty, value); }
    public bool IsExpanded { get => (bool)GetValue(IsExpandedProperty); set => SetValue(IsExpandedProperty, value); }

    public event RoutedEventHandler Toggled;

    private readonly Expander _expander;

    public ClefDisclosure()
    {
        _expander = new Expander { HorizontalAlignment = HorizontalAlignment.Stretch };
        _expander.Expanding += (s, e) => { IsExpanded = true; Toggled?.Invoke(this, new RoutedEventArgs()); };
        _expander.Collapsed += (s, e) => { IsExpanded = false; Toggled?.Invoke(this, new RoutedEventArgs()); };
        Content = _expander;
        UpdateVisual();
    }

    public void SetDisclosureContent(UIElement element) => _expander.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDisclosure)d).UpdateVisual();

    private void UpdateVisual()
    {
        _expander.Header = HeaderText;
        _expander.IsExpanded = IsExpanded;
    }
}
