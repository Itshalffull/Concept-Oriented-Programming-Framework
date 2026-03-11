// ============================================================
// Clef Surface WinUI Widget — Fieldset
//
// Groups related form fields with an optional legend/title.
// Provides a bordered container for logical form sections.
// Maps the fieldset.widget spec to WinUI 3 Border + TextBlock.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefFieldset : UserControl
{
    public static readonly DependencyProperty LegendProperty =
        DependencyProperty.Register(nameof(Legend), typeof(string), typeof(ClefFieldset),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsDisabledProperty =
        DependencyProperty.Register(nameof(IsDisabled), typeof(bool), typeof(ClefFieldset),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Legend { get => (string)GetValue(LegendProperty); set => SetValue(LegendProperty, value); }
    public bool IsDisabled { get => (bool)GetValue(IsDisabledProperty); set => SetValue(IsDisabledProperty, value); }

    private readonly StackPanel _root;
    private readonly TextBlock _legendBlock;
    private readonly Border _border;
    private readonly StackPanel _contentPanel;

    public ClefFieldset()
    {
        _legendBlock = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 4),
            Visibility = Visibility.Collapsed
        };
        _contentPanel = new StackPanel { Spacing = 8 };
        _border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Gray),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(12),
            Child = _contentPanel
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_legendBlock);
        _root.Children.Add(_border);
        Content = _root;
        UpdateVisual();
    }

    public void AddField(UIElement element) => _contentPanel.Children.Add(element);

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefFieldset)d).UpdateVisual();

    private void UpdateVisual()
    {
        _legendBlock.Text = Legend ?? "";
        _legendBlock.Visibility = string.IsNullOrEmpty(Legend) ? Visibility.Collapsed : Visibility.Visible;
        _root.Opacity = IsDisabled ? 0.5 : 1.0;
        _root.IsHitTestVisible = !IsDisabled;
    }
}
