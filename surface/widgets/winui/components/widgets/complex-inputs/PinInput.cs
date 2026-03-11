// ============================================================
// Clef Surface WinUI Widget — PinInput
//
// Multi-digit PIN or OTP code input with individual character
// fields. Auto-advances focus between fields. Maps the
// pininput.widget spec to WinUI 3 row of TextBox controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefPinInput : UserControl
{
    public static readonly DependencyProperty LengthProperty =
        DependencyProperty.Register(nameof(Length), typeof(int), typeof(ClefPinInput),
            new PropertyMetadata(4, OnPropertyChanged));

    public static readonly DependencyProperty IsMaskedProperty =
        DependencyProperty.Register(nameof(IsMasked), typeof(bool), typeof(ClefPinInput),
            new PropertyMetadata(false, OnPropertyChanged));

    public int Length { get => (int)GetValue(LengthProperty); set => SetValue(LengthProperty, value); }
    public bool IsMasked { get => (bool)GetValue(IsMaskedProperty); set => SetValue(IsMaskedProperty, value); }

    public event System.EventHandler<string> Completed;

    private readonly StackPanel _root;
    private readonly List<TextBox> _fields = new();

    public ClefPinInput()
    {
        _root = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        Content = _root;
        BuildFields();
    }

    private void BuildFields()
    {
        _root.Children.Clear();
        _fields.Clear();
        for (int i = 0; i < Length; i++)
        {
            int index = i;
            var tb = new TextBox
            {
                MaxLength = 1,
                Width = 40,
                TextAlignment = TextAlignment.Center,
                FontSize = 18
            };
            tb.TextChanged += (s, e) =>
            {
                if (tb.Text.Length == 1 && index < _fields.Count - 1)
                    _fields[index + 1].Focus(FocusState.Programmatic);
                CheckComplete();
            };
            _fields.Add(tb);
            _root.Children.Add(tb);
        }
    }

    private void CheckComplete()
    {
        var pin = "";
        foreach (var f in _fields)
        {
            if (string.IsNullOrEmpty(f.Text)) return;
            pin += f.Text;
        }
        Completed?.Invoke(this, pin);
    }

    public string GetValue()
    {
        var pin = "";
        foreach (var f in _fields) pin += f.Text;
        return pin;
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefPinInput)d).BuildFields();
}
