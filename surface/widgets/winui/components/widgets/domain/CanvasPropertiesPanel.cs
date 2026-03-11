// ============================================================
// Clef Surface WinUI Widget — CanvasPropertiesPanel
//
// Right sidebar panel showing properties of the selected canvas
// element. Uses a Pivot to switch between item properties,
// connector properties, and canvas-level properties based on
// selection. Maps the canvas-properties-panel.widget spec to
// WinUI 3 UserControl with Pivot and StackPanels.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefCanvasPropertiesPanel : UserControl
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefCanvasPropertiesPanel),
            new PropertyMetadata(""));

    public static readonly DependencyProperty SelectionTypeProperty =
        DependencyProperty.Register(nameof(SelectionType), typeof(string), typeof(ClefCanvasPropertiesPanel),
            new PropertyMetadata("none", OnPropertyChanged));

    public static readonly DependencyProperty SelectedItemIdProperty =
        DependencyProperty.Register(nameof(SelectedItemId), typeof(string), typeof(ClefCanvasPropertiesPanel),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty SelectedConnectorIdProperty =
        DependencyProperty.Register(nameof(SelectedConnectorId), typeof(string), typeof(ClefCanvasPropertiesPanel),
            new PropertyMetadata(null, OnPropertyChanged));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string SelectionType { get => (string)GetValue(SelectionTypeProperty); set => SetValue(SelectionTypeProperty, value); }
    public string SelectedItemId { get => (string)GetValue(SelectedItemIdProperty); set => SetValue(SelectedItemIdProperty, value); }
    public string SelectedConnectorId { get => (string)GetValue(SelectedConnectorIdProperty); set => SetValue(SelectedConnectorIdProperty, value); }

    public event System.EventHandler<PropertyChangedEventArgs> PropertyEdited;

    private readonly Pivot _pivot;
    private readonly PivotItem _itemTab;
    private readonly PivotItem _connectorTab;
    private readonly PivotItem _canvasTab;
    private readonly StackPanel _itemProperties;
    private readonly StackPanel _connectorProperties;
    private readonly StackPanel _canvasProperties;
    private readonly TextBlock _emptyState;
    private readonly Grid _root;

    public ClefCanvasPropertiesPanel()
    {
        // Item properties panel
        _itemProperties = new StackPanel { Spacing = 8, Padding = new Thickness(8) };
        _itemProperties.Children.Add(new TextBox { Header = "Label", PlaceholderText = "Item label" });
        _itemProperties.Children.Add(new NumberBox { Header = "X", SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact });
        _itemProperties.Children.Add(new NumberBox { Header = "Y", SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact });
        _itemProperties.Children.Add(new NumberBox { Header = "Width", SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact });
        _itemProperties.Children.Add(new NumberBox { Header = "Height", SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact });
        _itemProperties.Children.Add(new ComboBox { Header = "Display As", HorizontalAlignment = HorizontalAlignment.Stretch });
        AutomationProperties.SetName(_itemProperties, "Item properties");

        _itemTab = new PivotItem
        {
            Header = "Item",
            Content = new ScrollViewer
            {
                Content = _itemProperties,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            }
        };

        // Connector properties panel
        _connectorProperties = new StackPanel { Spacing = 8, Padding = new Thickness(8) };
        _connectorProperties.Children.Add(new TextBox { Header = "Label", PlaceholderText = "Connector label" });
        _connectorProperties.Children.Add(new ComboBox { Header = "Style", HorizontalAlignment = HorizontalAlignment.Stretch });
        _connectorProperties.Children.Add(new ComboBox { Header = "Kind", HorizontalAlignment = HorizontalAlignment.Stretch });
        AutomationProperties.SetName(_connectorProperties, "Connector properties");

        _connectorTab = new PivotItem
        {
            Header = "Connector",
            Content = new ScrollViewer
            {
                Content = _connectorProperties,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            }
        };

        // Canvas properties panel
        _canvasProperties = new StackPanel { Spacing = 8, Padding = new Thickness(8) };
        _canvasProperties.Children.Add(new TextBox { Header = "Canvas Name", PlaceholderText = "Untitled canvas" });
        _canvasProperties.Children.Add(new ToggleSwitch { Header = "Show Grid" });
        _canvasProperties.Children.Add(new ComboBox { Header = "Notation", HorizontalAlignment = HorizontalAlignment.Stretch });
        AutomationProperties.SetName(_canvasProperties, "Canvas properties");

        _canvasTab = new PivotItem
        {
            Header = "Canvas",
            Content = new ScrollViewer
            {
                Content = _canvasProperties,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            }
        };

        // Pivot control
        _pivot = new Pivot();
        _pivot.Items.Add(_itemTab);
        _pivot.Items.Add(_connectorTab);
        _pivot.Items.Add(_canvasTab);

        // Empty state placeholder
        _emptyState = new TextBlock
        {
            Text = "Nothing selected",
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Opacity = 0.5,
            FontSize = 14,
            Margin = new Thickness(0, 40, 0, 0)
        };

        _root = new Grid { MinWidth = 260 };
        _root.Children.Add(_pivot);
        _root.Children.Add(_emptyState);

        AutomationProperties.SetName(_root, "Properties panel");
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefCanvasPropertiesPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        switch (SelectionType)
        {
            case "item":
                _pivot.Visibility = Visibility.Visible;
                _emptyState.Visibility = Visibility.Collapsed;
                _pivot.SelectedItem = _itemTab;
                break;

            case "connector":
                _pivot.Visibility = Visibility.Visible;
                _emptyState.Visibility = Visibility.Collapsed;
                _pivot.SelectedItem = _connectorTab;
                break;

            case "canvas":
                _pivot.Visibility = Visibility.Visible;
                _emptyState.Visibility = Visibility.Collapsed;
                _pivot.SelectedItem = _canvasTab;
                break;

            default: // "none"
                _pivot.Visibility = Visibility.Collapsed;
                _emptyState.Visibility = Visibility.Visible;
                break;
        }
    }

    public record PropertyChangedEventArgs(string PropertyName, object Value);
}
