// ============================================================
// Clef Surface WinUI Widget — CanvasNode
//
// Draggable node element placed on a Canvas. Displays a title,
// input/output ports. Maps the canvasnode.widget spec to WinUI 3
// Border with content and drag interaction.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefCanvasNode : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefCanvasNode),
            new PropertyMetadata("Node", OnPropertyChanged));

    public static readonly DependencyProperty IsSelectedProperty =
        DependencyProperty.Register(nameof(IsSelected), typeof(bool), typeof(ClefCanvasNode),
            new PropertyMetadata(false, OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public bool IsSelected { get => (bool)GetValue(IsSelectedProperty); set => SetValue(IsSelectedProperty, value); }

    public event RoutedEventHandler Selected;

    private readonly Border _border;
    private readonly TextBlock _titleBlock;
    private readonly ContentPresenter _body;

    public ClefCanvasNode()
    {
        _titleBlock = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 4)
        };
        _body = new ContentPresenter();
        var root = new StackPanel { Spacing = 4 };
        root.Children.Add(_titleBlock);
        root.Children.Add(_body);
        _border = new Border
        {
            BorderThickness = new Thickness(2),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Gray),
            CornerRadius = new CornerRadius(6),
            Padding = new Thickness(12),
            Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.White),
            Child = root,
            MinWidth = 120
        };
        _border.PointerPressed += (s, e) => { IsSelected = true; Selected?.Invoke(this, new RoutedEventArgs()); };
        Content = _border;
        UpdateVisual();
    }

    public void SetBody(UIElement element) => _body.Content = element;

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCanvasNode)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "Node";
        _border.BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(
            IsSelected ? Microsoft.UI.Colors.CornflowerBlue : Microsoft.UI.Colors.Gray);
    }
}
