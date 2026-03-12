// ============================================================
// Clef Surface WinUI Widget — CanvasPanel
//
// Generic collapsible panel for canvas sidebars. Provides a
// header row with title and collapse/expand button, a scrollable
// body area for arbitrary child content, and a resize handle
// border. Supports expanded, collapsed, and minimized states
// with left or right dock positioning. Maps the
// canvas-panel.widget spec to WinUI 3 UserControl.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefCanvasPanel : UserControl
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefCanvasPanel),
            new PropertyMetadata(""));

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefCanvasPanel),
            new PropertyMetadata("Panel", OnPropertyChanged));

    public static readonly DependencyProperty DockProperty =
        DependencyProperty.Register(nameof(Dock), typeof(string), typeof(ClefCanvasPanel),
            new PropertyMetadata("right", OnPropertyChanged));

    public static readonly DependencyProperty DefaultWidthProperty =
        DependencyProperty.Register(nameof(DefaultWidth), typeof(double), typeof(ClefCanvasPanel),
            new PropertyMetadata(320.0, OnPropertyChanged));

    public static readonly DependencyProperty IsCollapsibleProperty =
        DependencyProperty.Register(nameof(IsCollapsible), typeof(bool), typeof(ClefCanvasPanel),
            new PropertyMetadata(true, OnPropertyChanged));

    public static readonly DependencyProperty PanelStateProperty =
        DependencyProperty.Register(nameof(PanelState), typeof(string), typeof(ClefCanvasPanel),
            new PropertyMetadata("expanded", OnPropertyChanged));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }
    public string Dock { get => (string)GetValue(DockProperty); set => SetValue(DockProperty, value); }
    public double DefaultWidth { get => (double)GetValue(DefaultWidthProperty); set => SetValue(DefaultWidthProperty, value); }
    public bool IsCollapsible { get => (bool)GetValue(IsCollapsibleProperty); set => SetValue(IsCollapsibleProperty, value); }
    public string PanelState { get => (string)GetValue(PanelStateProperty); set => SetValue(PanelStateProperty, value); }

    public event System.EventHandler<PanelStateChangedEventArgs> PanelStateChanged;

    private readonly Grid _root;
    private readonly Grid _headerRow;
    private readonly TextBlock _titleBlock;
    private readonly Button _collapseButton;
    private readonly ScrollViewer _bodyScroller;
    private readonly Border _resizeHandle;
    private UIElement _panelContent;

    public ClefCanvasPanel()
    {
        // Header: title text + collapse button
        _titleBlock = new TextBlock
        {
            Text = "Panel",
            FontSize = 14,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(8, 0, 0, 0)
        };

        _collapseButton = new Button
        {
            Content = new FontIcon { Glyph = "\uE70E", FontSize = 12 },
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
            Padding = new Thickness(6),
            Background = new SolidColorBrush(Colors.Transparent)
        };
        _collapseButton.Click += OnCollapseButtonClick;
        AutomationProperties.SetName(_collapseButton, "Toggle panel");

        _headerRow = new Grid
        {
            Padding = new Thickness(4),
            MinHeight = 36,
            BorderBrush = new SolidColorBrush(Colors.Gray),
            BorderThickness = new Thickness(0, 0, 0, 1)
        };
        _headerRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _headerRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        Grid.SetColumn(_titleBlock, 0);
        Grid.SetColumn(_collapseButton, 1);
        _headerRow.Children.Add(_titleBlock);
        _headerRow.Children.Add(_collapseButton);
        AutomationProperties.SetName(_headerRow, "Panel header");

        // Body: scrollable content area
        _bodyScroller = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            Padding = new Thickness(0)
        };
        AutomationProperties.SetName(_bodyScroller, "Panel body");

        // Resize handle border along the dock edge
        _resizeHandle = new Border
        {
            Width = 4,
            Background = new SolidColorBrush(Colors.Transparent),
            Cursor = Microsoft.UI.Input.InputSystemCursor.Create(Microsoft.UI.Input.InputSystemCursorShape.SizeWestEast),
            HorizontalAlignment = HorizontalAlignment.Left
        };
        AutomationProperties.SetName(_resizeHandle, "Resize handle");

        // Root grid: header row + body row
        _root = new Grid
        {
            Width = 320,
            MinWidth = 200
        };
        _root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        _root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        _root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        _root.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        Grid.SetRow(_headerRow, 0);
        Grid.SetColumn(_headerRow, 0);
        Grid.SetColumnSpan(_headerRow, 2);

        Grid.SetRow(_bodyScroller, 1);
        Grid.SetColumn(_bodyScroller, 1);

        Grid.SetRow(_resizeHandle, 0);
        Grid.SetColumn(_resizeHandle, 0);
        Grid.SetRowSpan(_resizeHandle, 2);

        _root.Children.Add(_resizeHandle);
        _root.Children.Add(_headerRow);
        _root.Children.Add(_bodyScroller);

        AutomationProperties.SetName(_root, "Canvas panel");
        Content = _root;
        UpdateVisual();
    }

    /// <summary>
    /// Gets or sets the child content displayed in the panel body.
    /// </summary>
    public new UIElement Content
    {
        get => _panelContent;
        set
        {
            _panelContent = value;
            if (_bodyScroller != null)
            {
                _bodyScroller.Content = value;
            }
        }
    }

    /// <summary>
    /// Sets the child content displayed inside the scrollable body area.
    /// Use this instead of Content to avoid replacing the panel root.
    /// </summary>
    public void SetPanelContent(UIElement content)
    {
        _panelContent = content;
        _bodyScroller.Content = content;
    }

    private void OnCollapseButtonClick(object sender, RoutedEventArgs e)
    {
        if (!IsCollapsible) return;

        var oldState = PanelState;
        PanelState = PanelState switch
        {
            "expanded" => "collapsed",
            "collapsed" => "expanded",
            "minimized" => "expanded",
            _ => "expanded"
        };

        PanelStateChanged?.Invoke(this, new PanelStateChangedEventArgs(oldState, PanelState));
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCanvasPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title;
        _root.Width = DefaultWidth;

        // Collapse button visibility
        _collapseButton.Visibility = IsCollapsible ? Visibility.Visible : Visibility.Collapsed;

        // Collapse button glyph: chevron direction depends on state and dock
        var isExpanded = PanelState == "expanded";
        if (Dock == "left")
        {
            ((FontIcon)_collapseButton.Content).Glyph = isExpanded ? "\uE76B" : "\uE76C";
        }
        else
        {
            ((FontIcon)_collapseButton.Content).Glyph = isExpanded ? "\uE76C" : "\uE76B";
        }

        // Resize handle position based on dock side
        _resizeHandle.HorizontalAlignment = Dock == "left"
            ? HorizontalAlignment.Right
            : HorizontalAlignment.Left;

        // Body visibility based on panel state
        switch (PanelState)
        {
            case "expanded":
                _bodyScroller.Visibility = Visibility.Visible;
                _root.Width = DefaultWidth;
                break;

            case "collapsed":
                _bodyScroller.Visibility = Visibility.Collapsed;
                _root.Width = double.NaN; // Auto-size to header only
                break;

            case "minimized":
                _bodyScroller.Visibility = Visibility.Collapsed;
                _root.Width = 36; // Icon-width strip
                break;
        }
    }

    public record PanelStateChangedEventArgs(string OldState, string NewState);
}
