// ============================================================
// Clef Surface WinUI Widget — FormulaEditor
//
// Text input specialized for mathematical or spreadsheet-like
// formulas with syntax highlighting cues. Maps the
// formulaeditor.widget spec to WinUI 3 TextBox with
// validation feedback.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefFormulaEditor : UserControl
{
    public static readonly DependencyProperty FormulaProperty =
        DependencyProperty.Register(nameof(Formula), typeof(string), typeof(ClefFormulaEditor),
            new PropertyMetadata("", OnPropertyChanged));

    public static readonly DependencyProperty IsValidProperty =
        DependencyProperty.Register(nameof(IsValid), typeof(bool), typeof(ClefFormulaEditor),
            new PropertyMetadata(true, OnPropertyChanged));

    public static readonly DependencyProperty ErrorMessageProperty =
        DependencyProperty.Register(nameof(ErrorMessage), typeof(string), typeof(ClefFormulaEditor),
            new PropertyMetadata(null, OnPropertyChanged));

    public string Formula { get => (string)GetValue(FormulaProperty); set => SetValue(FormulaProperty, value); }
    public bool IsValid { get => (bool)GetValue(IsValidProperty); set => SetValue(IsValidProperty, value); }
    public string ErrorMessage { get => (string)GetValue(ErrorMessageProperty); set => SetValue(ErrorMessageProperty, value); }

    public event System.EventHandler<string> FormulaChanged;

    private readonly StackPanel _root;
    private readonly TextBox _input;
    private readonly TextBlock _errorBlock;

    public ClefFormulaEditor()
    {
        _input = new TextBox
        {
            FontFamily = new Microsoft.UI.Xaml.Media.FontFamily("Consolas"),
            PlaceholderText = "Enter formula (e.g., =SUM(A1:A10))"
        };
        _input.TextChanged += (s, e) =>
        {
            Formula = _input.Text;
            FormulaChanged?.Invoke(this, _input.Text);
        };
        _errorBlock = new TextBlock
        {
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Red),
            FontSize = 12,
            Visibility = Visibility.Collapsed
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(_input);
        _root.Children.Add(_errorBlock);
        Content = _root;
        UpdateVisual();
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefFormulaEditor)d).UpdateVisual();

    private void UpdateVisual()
    {
        if (_input.Text != Formula) _input.Text = Formula ?? "";
        _errorBlock.Text = ErrorMessage ?? "";
        _errorBlock.Visibility = IsValid || string.IsNullOrEmpty(ErrorMessage) ? Visibility.Collapsed : Visibility.Visible;
        _input.BorderBrush = IsValid
            ? null
            : new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Red);
    }
}
