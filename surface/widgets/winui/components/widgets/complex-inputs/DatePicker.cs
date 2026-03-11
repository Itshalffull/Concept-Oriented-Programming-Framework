// ============================================================
// Clef Surface WinUI Widget — DatePicker
//
// Date selection with calendar dropdown. Maps the
// datepicker.widget spec to WinUI 3 CalendarDatePicker.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefDatePicker : UserControl
{
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(ClefDatePicker),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(nameof(Placeholder), typeof(string), typeof(ClefDatePicker),
            new PropertyMetadata("Select a date", OnPropertyChanged));

    public static readonly DependencyProperty IsEnabledOverrideProperty =
        DependencyProperty.Register(nameof(IsEnabledOverride), typeof(bool), typeof(ClefDatePicker),
            new PropertyMetadata(true, OnPropertyChanged));

    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public string Placeholder { get => (string)GetValue(PlaceholderProperty); set => SetValue(PlaceholderProperty, value); }
    public bool IsEnabledOverride { get => (bool)GetValue(IsEnabledOverrideProperty); set => SetValue(IsEnabledOverrideProperty, value); }

    public event EventHandler<DateTimeOffset?> DateChanged;

    private readonly StackPanel _root;
    private readonly TextBlock _labelBlock;
    private readonly CalendarDatePicker _datePicker;

    public ClefDatePicker()
    {
        _labelBlock = new TextBlock
        {
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Visibility = Visibility.Collapsed
        };
        _datePicker = new CalendarDatePicker();
        _datePicker.DateChanged += (s, e) => DateChanged?.Invoke(this, _datePicker.Date);
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_labelBlock);
        _root.Children.Add(_datePicker);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDatePicker)d).UpdateVisual();

    private void UpdateVisual()
    {
        _labelBlock.Text = Label ?? "";
        _labelBlock.Visibility = string.IsNullOrEmpty(Label) ? Visibility.Collapsed : Visibility.Visible;
        _datePicker.PlaceholderText = Placeholder;
        _datePicker.IsEnabled = IsEnabledOverride;
    }
}
