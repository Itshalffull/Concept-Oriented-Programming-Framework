// ============================================================
// Clef Surface WinUI Widget — Toolbar
//
// Horizontal bar of action buttons and controls. Supports
// grouping with separators. Maps the toolbar.widget spec to
// WinUI 3 CommandBar.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefToolbar : UserControl
{
    public static readonly DependencyProperty ShowLabelsProperty =
        DependencyProperty.Register(nameof(ShowLabels), typeof(bool), typeof(ClefToolbar),
            new PropertyMetadata(true, OnPropertyChanged));

    public bool ShowLabels { get => (bool)GetValue(ShowLabelsProperty); set => SetValue(ShowLabelsProperty, value); }

    public event System.EventHandler<string> ActionInvoked;

    private readonly CommandBar _commandBar;

    public ClefToolbar()
    {
        _commandBar = new CommandBar();
        Content = _commandBar;
        UpdateVisual();
    }

    public void AddAction(string label, Symbol icon, bool isSecondary = false)
    {
        var btn = new AppBarButton { Icon = new SymbolIcon(icon), Label = label };
        btn.Click += (s, e) => ActionInvoked?.Invoke(this, label);
        if (isSecondary) _commandBar.SecondaryCommands.Add(btn);
        else _commandBar.PrimaryCommands.Add(btn);
    }

    public void AddSeparator() => _commandBar.PrimaryCommands.Add(new AppBarSeparator());

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefToolbar)d).UpdateVisual();

    private void UpdateVisual()
    {
        _commandBar.DefaultLabelPosition = ShowLabels
            ? CommandBarDefaultLabelPosition.Bottom
            : CommandBarDefaultLabelPosition.Collapsed;
    }
}
