// ============================================================
// Clef Surface WinUI Widget — ConnectorPortIndicator
//
// Visual indicator for a ConnectorPort on a canvas item. Shows
// direction via color (blue=in, orange=out, green=bidirectional),
// optional label, and connection count badge. Maps the
// connector-port-indicator.widget spec to a WinUI 3 Ellipse.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefConnectorPortIndicator : UserControl
{
    public static readonly DependencyProperty PortIdProperty =
        DependencyProperty.Register(nameof(PortId), typeof(string), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(""));

    public static readonly DependencyProperty DirectionProperty =
        DependencyProperty.Register(nameof(Direction), typeof(string), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata("in", OnPropertyChanged));

    public static readonly DependencyProperty PortTypeProperty =
        DependencyProperty.Register(nameof(PortType), typeof(string), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(null));

    public static readonly DependencyProperty PortLabelProperty =
        DependencyProperty.Register(nameof(PortLabel), typeof(string), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty SideProperty =
        DependencyProperty.Register(nameof(Side), typeof(string), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata("right", OnPropertyChanged));

    public static readonly DependencyProperty OffsetProperty =
        DependencyProperty.Register(nameof(Offset), typeof(double), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(0.5));

    public static readonly DependencyProperty ConnectionCountProperty =
        DependencyProperty.Register(nameof(ConnectionCount), typeof(int), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(0, OnPropertyChanged));

    public static readonly DependencyProperty MaxConnectionsProperty =
        DependencyProperty.Register(nameof(MaxConnections), typeof(int), typeof(ClefConnectorPortIndicator),
            new PropertyMetadata(-1, OnPropertyChanged));

    public string PortId { get => (string)GetValue(PortIdProperty); set => SetValue(PortIdProperty, value); }
    public string Direction { get => (string)GetValue(DirectionProperty); set => SetValue(DirectionProperty, value); }
    public string PortType { get => (string)GetValue(PortTypeProperty); set => SetValue(PortTypeProperty, value); }
    public string PortLabel { get => (string)GetValue(PortLabelProperty); set => SetValue(PortLabelProperty, value); }
    public string Side { get => (string)GetValue(SideProperty); set => SetValue(SideProperty, value); }
    public double Offset { get => (double)GetValue(OffsetProperty); set => SetValue(OffsetProperty, value); }
    public int ConnectionCount { get => (int)GetValue(ConnectionCountProperty); set => SetValue(ConnectionCountProperty, value); }
    public int MaxConnections { get => (int)GetValue(MaxConnectionsProperty); set => SetValue(MaxConnectionsProperty, value); }

    public event System.EventHandler ConnectStarted;

    private readonly Ellipse _portDot;
    private readonly TextBlock _labelBlock;
    private readonly TextBlock _badge;
    private readonly Grid _root;

    public ClefConnectorPortIndicator()
    {
        _portDot = new Ellipse
        {
            Width = 10,
            Height = 10,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };

        _labelBlock = new TextBlock
        {
            FontSize = 10,
            Visibility = Visibility.Collapsed,
            Margin = new Thickness(4, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Center
        };

        _badge = new TextBlock
        {
            FontSize = 9,
            Visibility = Visibility.Collapsed,
            VerticalAlignment = VerticalAlignment.Top,
            HorizontalAlignment = HorizontalAlignment.Right
        };

        var stack = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 2
        };
        stack.Children.Add(_portDot);
        stack.Children.Add(_labelBlock);

        _root = new Grid();
        _root.Children.Add(stack);
        _root.Children.Add(_badge);

        _root.PointerEntered += (s, e) =>
        {
            _portDot.Width = 14;
            _portDot.Height = 14;
            if (!string.IsNullOrEmpty(PortLabel)) _labelBlock.Visibility = Visibility.Visible;
        };
        _root.PointerExited += (s, e) =>
        {
            _portDot.Width = 10;
            _portDot.Height = 10;
            _labelBlock.Visibility = Visibility.Collapsed;
        };
        _root.PointerPressed += (s, e) => ConnectStarted?.Invoke(this, System.EventArgs.Empty);

        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefConnectorPortIndicator)d).UpdateVisual();

    private void UpdateVisual()
    {
        var color = Direction switch
        {
            "in" => Colors.DodgerBlue,
            "out" => Colors.Orange,
            "bidirectional" => Colors.Green,
            _ => Colors.Gray
        };
        _portDot.Fill = new SolidColorBrush(color);

        _labelBlock.Text = PortLabel ?? "";

        if (ConnectionCount > 0)
        {
            _badge.Visibility = Visibility.Visible;
            _badge.Text = MaxConnections > 0
                ? $"{ConnectionCount}/{MaxConnections}"
                : ConnectionCount.ToString();
        }
        else
        {
            _badge.Visibility = Visibility.Collapsed;
        }

        var ariaLabel = $"{Direction} port";
        if (!string.IsNullOrEmpty(PortLabel)) ariaLabel += $": {PortLabel}";
        ariaLabel += $" ({ConnectionCount}";
        if (MaxConnections > 0) ariaLabel += $"/{MaxConnections}";
        ariaLabel += " connections)";
        AutomationProperties.SetName(_root, ariaLabel);
    }
}
