// ============================================================
// Clef Surface WinUI Widget — SignaturePad
//
// Touch/pen-based signature capture area with clear button.
// Maps the signaturepad.widget spec to WinUI 3 InkCanvas.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Input.Inking;

namespace Clef.Surface.WinUI.Widgets.ComplexInputs;

public sealed class ClefSignaturePad : UserControl
{
    public static readonly DependencyProperty StrokeColorProperty =
        DependencyProperty.Register(nameof(StrokeColor), typeof(string), typeof(ClefSignaturePad),
            new PropertyMetadata("black"));

    public static readonly DependencyProperty StrokeWidthProperty =
        DependencyProperty.Register(nameof(StrokeWidth), typeof(double), typeof(ClefSignaturePad),
            new PropertyMetadata(2.0));

    public string StrokeColor { get => (string)GetValue(StrokeColorProperty); set => SetValue(StrokeColorProperty, value); }
    public double StrokeWidth { get => (double)GetValue(StrokeWidthProperty); set => SetValue(StrokeWidthProperty, value); }

    public event RoutedEventHandler Cleared;

    private readonly StackPanel _root;
    private readonly InkCanvas _inkCanvas;
    private readonly InkPresenter _inkPresenter;
    private readonly Button _clearBtn;

    public ClefSignaturePad()
    {
        _inkCanvas = new InkCanvas { Height = 150 };
        _inkPresenter = _inkCanvas.InkPresenter;
        _inkPresenter.InputDeviceTypes = Windows.UI.Core.CoreInputDeviceTypes.Mouse
            | Windows.UI.Core.CoreInputDeviceTypes.Pen
            | Windows.UI.Core.CoreInputDeviceTypes.Touch;
        var attrs = new InkDrawingAttributes
        {
            Color = Microsoft.UI.Colors.Black,
            Size = new Windows.Foundation.Size(2, 2)
        };
        _inkPresenter.UpdateDefaultDrawingAttributes(attrs);
        _clearBtn = new Button { Content = "Clear", HorizontalAlignment = HorizontalAlignment.Right };
        _clearBtn.Click += (s, e) =>
        {
            _inkPresenter.StrokeContainer.Clear();
            Cleared?.Invoke(this, new RoutedEventArgs());
        };
        var border = new Border
        {
            BorderThickness = new Thickness(1),
            BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Gray),
            CornerRadius = new CornerRadius(4),
            Child = _inkCanvas
        };
        _root = new StackPanel { Spacing = 4 };
        _root.Children.Add(border);
        _root.Children.Add(_clearBtn);
        Content = _root;
    }
}
