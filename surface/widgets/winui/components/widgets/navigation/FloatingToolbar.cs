// ============================================================
// Clef Surface WinUI Widget — FloatingToolbar
//
// Context-sensitive toolbar that floats near selected content.
// Typically used for text formatting or quick actions. Maps
// the floatingtoolbar.widget spec to WinUI 3 CommandBar
// inside a Popup.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefFloatingToolbar : UserControl
{
    public static readonly DependencyProperty IsOpenProperty =
        DependencyProperty.Register(nameof(IsOpen), typeof(bool), typeof(ClefFloatingToolbar),
            new PropertyMetadata(false, OnPropertyChanged));

    public bool IsOpen { get => (bool)GetValue(IsOpenProperty); set => SetValue(IsOpenProperty, value); }

    public event System.EventHandler<string> ActionInvoked;

    private readonly Popup _popup;
    private readonly CommandBar _commandBar;

    public ClefFloatingToolbar()
    {
        _commandBar = new CommandBar { DefaultLabelPosition = CommandBarDefaultLabelPosition.Collapsed };
        _popup = new Popup { Child = _commandBar };
        Content = new Grid();
        UpdateVisual();
    }

    public void AddAction(string label, Symbol icon)
    {
        var btn = new AppBarButton { Icon = new SymbolIcon(icon), Label = label };
        btn.Click += (s, e) => ActionInvoked?.Invoke(this, label);
        _commandBar.PrimaryCommands.Add(btn);
    }

    public void SetPosition(double x, double y)
    {
        _popup.HorizontalOffset = x;
        _popup.VerticalOffset = y;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefFloatingToolbar)d).UpdateVisual();

    private void UpdateVisual()
    {
        _popup.IsOpen = IsOpen;
    }
}
