// ============================================================
// Clef Surface WinUI Widget — LayoutControlPanel
//
// Control panel for selecting and applying layout algorithms to
// a canvas. Provides algorithm selector, direction options,
// spacing controls, and apply button. Maps the
// layout-control-panel.widget spec to WinUI 3 controls.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefLayoutControlPanel : UserControl
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefLayoutControlPanel),
            new PropertyMetadata(""));

    public static readonly DependencyProperty SelectedAlgorithmProperty =
        DependencyProperty.Register(nameof(SelectedAlgorithm), typeof(string), typeof(ClefLayoutControlPanel),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty DirectionValueProperty =
        DependencyProperty.Register(nameof(DirectionValue), typeof(string), typeof(ClefLayoutControlPanel),
            new PropertyMetadata("top-to-bottom", OnPropertyChanged));

    public static readonly DependencyProperty SpacingXProperty =
        DependencyProperty.Register(nameof(SpacingX), typeof(double), typeof(ClefLayoutControlPanel),
            new PropertyMetadata(80.0, OnPropertyChanged));

    public static readonly DependencyProperty SpacingYProperty =
        DependencyProperty.Register(nameof(SpacingY), typeof(double), typeof(ClefLayoutControlPanel),
            new PropertyMetadata(100.0));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string SelectedAlgorithm { get => (string)GetValue(SelectedAlgorithmProperty); set => SetValue(SelectedAlgorithmProperty, value); }
    public string DirectionValue { get => (string)GetValue(DirectionValueProperty); set => SetValue(DirectionValueProperty, value); }
    public double SpacingX { get => (double)GetValue(SpacingXProperty); set => SetValue(SpacingXProperty, value); }
    public double SpacingY { get => (double)GetValue(SpacingYProperty); set => SetValue(SpacingYProperty, value); }

    public event System.EventHandler<LayoutApplyEventArgs> ApplyRequested;

    private readonly StackPanel _root;
    private readonly ComboBox _algorithmSelector;
    private readonly RadioButtons _directionSelector;
    private readonly Slider _spacingSlider;
    private readonly Button _applyButton;

    public ClefLayoutControlPanel()
    {
        _algorithmSelector = new ComboBox
        {
            Header = "Layout Algorithm",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _algorithmSelector.SelectionChanged += (s, e) =>
        {
            if (_algorithmSelector.SelectedItem is ComboBoxItem item)
            {
                SelectedAlgorithm = item.Tag?.ToString();
            }
        };
        AutomationProperties.SetName(_algorithmSelector, "Layout algorithm");

        _directionSelector = new RadioButtons
        {
            Header = "Direction",
            Margin = new Thickness(0, 0, 0, 8)
        };
        _directionSelector.Items.Add(new RadioButton { Content = "Top to Bottom", Tag = "top-to-bottom" });
        _directionSelector.Items.Add(new RadioButton { Content = "Left to Right", Tag = "left-to-right" });
        _directionSelector.Items.Add(new RadioButton { Content = "Bottom to Top", Tag = "bottom-to-top" });
        _directionSelector.Items.Add(new RadioButton { Content = "Right to Left", Tag = "right-to-left" });
        _directionSelector.SelectedIndex = 0;
        _directionSelector.SelectionChanged += (s, e) =>
        {
            if (_directionSelector.SelectedItem is RadioButton rb)
            {
                DirectionValue = rb.Tag?.ToString() ?? "top-to-bottom";
            }
        };

        _spacingSlider = new Slider
        {
            Header = "Spacing",
            Minimum = 20,
            Maximum = 300,
            Value = 80,
            StepFrequency = 10,
            Margin = new Thickness(0, 0, 0, 12)
        };
        _spacingSlider.ValueChanged += (s, e) => SpacingX = e.NewValue;
        AutomationProperties.SetName(_spacingSlider, "Node spacing");

        _applyButton = new Button
        {
            Content = "Apply Layout",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            IsEnabled = false
        };
        _applyButton.Click += (s, e) =>
        {
            ApplyRequested?.Invoke(this, new LayoutApplyEventArgs(
                SelectedAlgorithm, DirectionValue, SpacingX, SpacingY));
        };
        AutomationProperties.SetName(_applyButton, "Apply layout");

        _root = new StackPanel { Spacing = 4, Padding = new Thickness(12) };
        _root.Children.Add(_algorithmSelector);
        _root.Children.Add(_directionSelector);
        _root.Children.Add(_spacingSlider);
        _root.Children.Add(_applyButton);

        AutomationProperties.SetName(_root, "Layout controls");
        Content = _root;
        UpdateVisual();
    }

    public void SetAlgorithms(System.Collections.Generic.IEnumerable<(string Name, string Label)> algorithms)
    {
        _algorithmSelector.Items.Clear();
        foreach (var (name, label) in algorithms)
        {
            _algorithmSelector.Items.Add(new ComboBoxItem { Content = label, Tag = name });
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefLayoutControlPanel)d).UpdateVisual();

    private void UpdateVisual()
    {
        _applyButton.IsEnabled = !string.IsNullOrEmpty(SelectedAlgorithm);
        _spacingSlider.Value = SpacingX;
    }

    public record LayoutApplyEventArgs(string Algorithm, string Direction, double SpacingX, double SpacingY);
}
