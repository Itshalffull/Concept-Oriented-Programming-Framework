// ============================================================
// Clef Surface WinUI Widget — EmptyState
//
// Placeholder display for when no data is available. Shows an
// icon, title, description, and optional action button. Maps
// the emptystate.widget spec to WinUI 3 StackPanel layout.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.DataDisplay;

public sealed class ClefEmptyState : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefEmptyState),
            new PropertyMetadata("No items", OnPropertyChanged));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefEmptyState),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ActionLabelProperty =
        DependencyProperty.Register(nameof(ActionLabel), typeof(string), typeof(ClefEmptyState),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public string ActionLabel { get => (string)GetValue(ActionLabelProperty); set => SetValue(ActionLabelProperty, value); }

    public event RoutedEventHandler ActionClicked;

    private readonly StackPanel _root;
    private readonly SymbolIcon _icon;
    private readonly TextBlock _titleBlock;
    private readonly TextBlock _descBlock;
    private readonly Button _actionBtn;

    public ClefEmptyState()
    {
        _icon = new SymbolIcon(Symbol.Document) { Width = 48, Height = 48 };
        _titleBlock = new TextBlock
        {
            FontSize = 18,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            HorizontalAlignment = HorizontalAlignment.Center
        };
        _descBlock = new TextBlock
        {
            Opacity = 0.7,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            Visibility = Visibility.Collapsed
        };
        _actionBtn = new Button { Visibility = Visibility.Collapsed };
        _actionBtn.Click += (s, e) => ActionClicked?.Invoke(this, new RoutedEventArgs());
        _root = new StackPanel
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Spacing = 12,
            Padding = new Thickness(32)
        };
        _root.Children.Add(_icon);
        _root.Children.Add(_titleBlock);
        _root.Children.Add(_descBlock);
        _root.Children.Add(_actionBtn);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefEmptyState)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "";
        _descBlock.Text = Description ?? "";
        _descBlock.Visibility = string.IsNullOrEmpty(Description) ? Visibility.Collapsed : Visibility.Visible;
        _actionBtn.Content = ActionLabel ?? "";
        _actionBtn.Visibility = string.IsNullOrEmpty(ActionLabel) ? Visibility.Collapsed : Visibility.Visible;
    }
}
