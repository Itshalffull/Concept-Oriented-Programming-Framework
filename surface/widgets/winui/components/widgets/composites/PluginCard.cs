// ============================================================
// Clef Surface WinUI Widget — PluginCard
//
// Card displaying plugin/extension info with name, version,
// description, and install/enable toggle. Maps the
// plugincard.widget spec to WinUI 3 Border with StackPanel.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefPluginCard : UserControl
{
    public static readonly DependencyProperty PluginNameProperty =
        DependencyProperty.Register(nameof(PluginName), typeof(string), typeof(ClefPluginCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty VersionProperty =
        DependencyProperty.Register(nameof(Version), typeof(string), typeof(ClefPluginCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty DescriptionProperty =
        DependencyProperty.Register(nameof(Description), typeof(string), typeof(ClefPluginCard),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledStateProperty =
        DependencyProperty.Register(nameof(IsEnabledState), typeof(bool), typeof(ClefPluginCard),
            new PropertyMetadata(false, OnPropertyChanged));

    public string PluginName { get => (string)GetValue(PluginNameProperty); set => SetValue(PluginNameProperty, value); }
    public string Version { get => (string)GetValue(VersionProperty); set => SetValue(VersionProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public bool IsEnabledState { get => (bool)GetValue(IsEnabledStateProperty); set => SetValue(IsEnabledStateProperty, value); }

    public event System.EventHandler<bool> EnabledChanged;

    private readonly Border _border;
    private readonly TextBlock _nameBlock;
    private readonly TextBlock _versionBlock;
    private readonly TextBlock _descBlock;
    private readonly ToggleSwitch _toggle;

    public ClefPluginCard()
    {
        _nameBlock = new TextBlock { FontSize = 14, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        _versionBlock = new TextBlock { FontSize = 11, Opacity = 0.5 };
        _descBlock = new TextBlock { Opacity = 0.7, TextWrapping = TextWrapping.Wrap };
        _toggle = new ToggleSwitch { OnContent = "Enabled", OffContent = "Disabled" };
        _toggle.Toggled += (s, e) => EnabledChanged?.Invoke(this, _toggle.IsOn);
        var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        header.Children.Add(_nameBlock);
        header.Children.Add(_versionBlock);
        var stack = new StackPanel { Spacing = 8 };
        stack.Children.Add(header);
        stack.Children.Add(_descBlock);
        stack.Children.Add(_toggle);
        _border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16),
            Child = stack
        };
        Content = _border;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPluginCard)d).UpdateVisual();

    private void UpdateVisual()
    {
        _nameBlock.Text = PluginName ?? "";
        _versionBlock.Text = Version != null ? $"v{Version}" : "";
        _descBlock.Text = Description ?? "";
        _toggle.IsOn = IsEnabledState;
    }
}
