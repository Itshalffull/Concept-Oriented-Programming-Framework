// ============================================================
// Clef Surface WinUI Widget — PropertyPanel
//
// Inspector-style panel showing editable properties of a
// selected object. Supports text, number, boolean, and select
// field types. Maps the propertypanel.widget spec to WinUI 3
// StackPanel with dynamic field controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.Composites;

public sealed class ClefPropertyPanel : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(ClefPropertyPanel),
            new PropertyMetadata("Properties", OnPropertyChanged));

    public string Title { get => (string)GetValue(TitleProperty); set => SetValue(TitleProperty, value); }

    public event System.EventHandler<(string Key, object Value)> PropertyChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _titleBlock;
    private readonly StackPanel _fields;

    public ClefPropertyPanel()
    {
        _titleBlock = new TextBlock { FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold };
        _fields = new StackPanel { Spacing = 8 };
        _root = new StackPanel { Spacing = 12, Padding = new Thickness(12) };
        _root.Children.Add(_titleBlock);
        _root.Children.Add(_fields);
        Content = _root;
        UpdateVisual();
    }

    public void AddTextField(string label, string value = "")
    {
        var lbl = new TextBlock { Text = label, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        var tb = new TextBox { Text = value };
        tb.TextChanged += (s, e) => PropertyChanged?.Invoke(this, (label, tb.Text));
        _fields.Children.Add(lbl);
        _fields.Children.Add(tb);
    }

    public void AddBoolField(string label, bool value = false)
    {
        var toggle = new ToggleSwitch { Header = label, IsOn = value };
        toggle.Toggled += (s, e) => PropertyChanged?.Invoke(this, (label, toggle.IsOn));
        _fields.Children.Add(toggle);
    }

    public void AddNumberField(string label, double value = 0)
    {
        var lbl = new TextBlock { Text = label, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold };
        var nb = new NumberBox { Value = value, SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact };
        nb.ValueChanged += (s, e) => PropertyChanged?.Invoke(this, (label, nb.Value));
        _fields.Children.Add(lbl);
        _fields.Children.Add(nb);
    }

    public void Clear() => _fields.Children.Clear();

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPropertyPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _titleBlock.Text = Title ?? "Properties";
    }
}
