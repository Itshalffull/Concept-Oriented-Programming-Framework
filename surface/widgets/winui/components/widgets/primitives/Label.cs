// ============================================================
// Clef Surface WinUI Widget — Label
//
// Accessible label text for a form control. Renders label text
// with an optional red asterisk indicating required fields.
// Disabled state dims the text opacity.
//
// Adapts the label.widget spec: anatomy (root,
// requiredIndicator), states (static), and connect attributes
// to WinUI 3 rendering.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Documents;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Primitives;

public sealed class ClefLabel : UserControl
{
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string), typeof(ClefLabel),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty IsRequiredProperty =
        DependencyProperty.Register(nameof(IsRequired), typeof(bool), typeof(ClefLabel),
            new PropertyMetadata(false, OnPropertyChanged));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefLabel),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Text { get => (string)GetValue(TextProperty); set => SetValue(TextProperty, value); }
    public bool IsRequired { get => (bool)GetValue(IsRequiredProperty); set => SetValue(IsRequiredProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }

    private readonly TextBlock _textBlock;

    public ClefLabel()
    {
        _textBlock = new TextBlock();
        Content = _textBlock;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefLabel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _textBlock.Inlines.Clear();
        _textBlock.Inlines.Add(new Run { Text = Text });
        if (IsRequired)
        {
            _textBlock.Inlines.Add(new Run
            {
                Text = " *",
                Foreground = new SolidColorBrush(Colors.Red)
            });
        }
        _textBlock.Opacity = IsDisabled ? 0.38 : 1.0;
    }
}
