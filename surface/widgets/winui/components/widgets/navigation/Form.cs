// ============================================================
// Clef Surface WinUI Widget — Form
//
// Container for form fields with validation and submission
// handling. Arranges fields vertically with submit/reset
// buttons. Maps the form.widget spec to WinUI 3 StackPanel.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Navigation;

public sealed class ClefForm : UserControl
{
    public static readonly DependencyProperty SubmitLabelProperty =
        DependencyProperty.Register(nameof(SubmitLabel), typeof(string), typeof(ClefForm),
            new PropertyMetadata("Submit", OnPropertyChanged));

    public static readonly DependencyProperty ShowResetProperty =
        DependencyProperty.Register(nameof(ShowReset), typeof(bool), typeof(ClefForm),
            new PropertyMetadata(false, OnPropertyChanged));

    public string SubmitLabel { get => (string)GetValue(SubmitLabelProperty); set => SetValue(SubmitLabelProperty, value); }
    public bool ShowReset { get => (bool)GetValue(ShowResetProperty); set => SetValue(ShowResetProperty, value); }

    public event RoutedEventHandler Submitted;
    public event RoutedEventHandler Reset;

    private readonly StackPanel _root;
    private readonly StackPanel _fields;
    private readonly StackPanel _actions;
    private readonly Button _submitBtn;
    private readonly Button _resetBtn;

    public ClefForm()
    {
        _fields = new StackPanel { Spacing = 12 };
        _submitBtn = new Button { Style = Application.Current.Resources["AccentButtonStyle"] as Style };
        _submitBtn.Click += (s, e) => Submitted?.Invoke(this, new RoutedEventArgs());
        _resetBtn = new Button { Content = "Reset", Visibility = Visibility.Collapsed };
        _resetBtn.Click += (s, e) => Reset?.Invoke(this, new RoutedEventArgs());
        _actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8,
            Margin = new Thickness(0, 12, 0, 0)
        };
        _actions.Children.Add(_submitBtn);
        _actions.Children.Add(_resetBtn);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_fields);
        _root.Children.Add(_actions);
        Content = _root;
        UpdateVisual();
    }

    public void AddField(UIElement element) => _fields.Children.Add(element);

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefForm)d).UpdateVisual();

    private void UpdateVisual()
    {
        _submitBtn.Content = SubmitLabel;
        _resetBtn.Visibility = ShowReset ? Visibility.Visible : Visibility.Collapsed;
    }
}
