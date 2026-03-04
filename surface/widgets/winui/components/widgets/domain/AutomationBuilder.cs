// ============================================================
// Clef Surface WinUI Widget — AutomationBuilder
//
// Visual builder for automation rules with trigger-condition-
// action chains. Maps the automationbuilder.widget spec to
// WinUI 3 StackPanel with dynamic rule rows.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefAutomationBuilder : UserControl
{
    public event RoutedEventHandler RulesChanged;

    private readonly StackPanel _root;
    private readonly StackPanel _rules;
    private readonly Button _addRuleBtn;

    public ClefAutomationBuilder()
    {
        _rules = new StackPanel { Spacing = 12 };
        _addRuleBtn = new Button { Content = "+ Add Rule" };
        _addRuleBtn.Click += (s, e) => AddRule();
        _root = new StackPanel { Spacing = 12 };
        _root.Children.Add(new TextBlock { Text = "Automation Rules", FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        _root.Children.Add(_rules);
        _root.Children.Add(_addRuleBtn);
        Content = _root;
    }

    public void AddRule()
    {
        var trigger = new TextBox { PlaceholderText = "When (trigger)...", Width = 200 };
        var condition = new TextBox { PlaceholderText = "If (condition)...", Width = 200 };
        var action = new TextBox { PlaceholderText = "Then (action)...", Width = 200 };
        var removeBtn = new Button { Content = new SymbolIcon(Symbol.Delete) };
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(trigger);
        row.Children.Add(condition);
        row.Children.Add(action);
        row.Children.Add(removeBtn);
        var border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.LightGray),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(8),
            Child = row
        };
        removeBtn.Click += (s, e) => { _rules.Children.Remove(border); RulesChanged?.Invoke(this, new RoutedEventArgs()); };
        _rules.Children.Add(border);
        RulesChanged?.Invoke(this, new RoutedEventArgs());
    }
}
