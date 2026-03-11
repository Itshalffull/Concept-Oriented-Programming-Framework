// Clef Surface WinUI Widget - WorkflowNode
// Adapts the workflownode.widget spec to WinUI 3 rendering.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefWorkflowNode : UserControl
{
    public static readonly DependencyProperty VariantProperty =
        DependencyProperty.Register(nameof(Variant), typeof(string), typeof(ClefWorkflowNode),
            new PropertyMetadata("default", OnPropertyChanged));

    public string Variant { get => (string)GetValue(VariantProperty); set => SetValue(VariantProperty, value); }

    private readonly StackPanel _root;
    private readonly TextBlock _label;

    public ClefWorkflowNode()
    {
        _label = new TextBlock { Text = "WorkflowNode", FontSize = 14 };
        _root = new StackPanel { Spacing = 8 };
        _root.Children.Add(_label);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefWorkflowNode)d).UpdateVisual();

    private void UpdateVisual()
    {
        AutomationProperties.SetName(_root, "WorkflowNode");
    }
}
