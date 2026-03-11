// ============================================================
// Clef Surface WinUI Widget — DiagramExportDialog
//
// Dialog for exporting a canvas diagram. Provides format
// selection, size options, background toggle, data embedding
// toggle, and export action. Maps the diagram-export-dialog
// .widget spec to a WinUI 3 ContentDialog.
// ============================================================

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Clef.Surface.WinUI.Widgets.Domain;

public sealed class ClefDiagramExportDialog : ContentDialog
{
    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(""));

    public static readonly DependencyProperty SelectedFormatProperty =
        DependencyProperty.Register(nameof(SelectedFormat), typeof(string), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(null, OnPropertyChanged));

    public static readonly DependencyProperty ExportWidthProperty =
        DependencyProperty.Register(nameof(ExportWidth), typeof(int), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(1920));

    public static readonly DependencyProperty ExportHeightProperty =
        DependencyProperty.Register(nameof(ExportHeight), typeof(int), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(1080));

    public static readonly DependencyProperty IncludeBackgroundProperty =
        DependencyProperty.Register(nameof(IncludeBackground), typeof(bool), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(true));

    public static readonly DependencyProperty EmbedDataProperty =
        DependencyProperty.Register(nameof(EmbedData), typeof(bool), typeof(ClefDiagramExportDialog),
            new PropertyMetadata(false));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string SelectedFormat { get => (string)GetValue(SelectedFormatProperty); set => SetValue(SelectedFormatProperty, value); }
    public int ExportWidth { get => (int)GetValue(ExportWidthProperty); set => SetValue(ExportWidthProperty, value); }
    public int ExportHeight { get => (int)GetValue(ExportHeightProperty); set => SetValue(ExportHeightProperty, value); }
    public bool IncludeBackground { get => (bool)GetValue(IncludeBackgroundProperty); set => SetValue(IncludeBackgroundProperty, value); }
    public bool EmbedData { get => (bool)GetValue(EmbedDataProperty); set => SetValue(EmbedDataProperty, value); }

    public event System.EventHandler<ExportRequestedEventArgs> ExportRequested;

    private readonly ComboBox _formatSelector;
    private readonly NumberBox _widthBox;
    private readonly NumberBox _heightBox;
    private readonly ToggleSwitch _backgroundToggle;
    private readonly ToggleSwitch _embedToggle;

    public ClefDiagramExportDialog()
    {
        Title = "Export Diagram";
        PrimaryButtonText = "Export";
        CloseButtonText = "Cancel";
        DefaultButton = ContentDialogButton.Primary;
        IsPrimaryButtonEnabled = false;

        _formatSelector = new ComboBox
        {
            Header = "Format",
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(0, 0, 0, 12)
        };
        _formatSelector.SelectionChanged += (s, e) =>
        {
            if (_formatSelector.SelectedItem is ComboBoxItem item)
            {
                SelectedFormat = item.Tag?.ToString();
            }
        };
        AutomationProperties.SetName(_formatSelector, "Export format");

        _widthBox = new NumberBox
        {
            Header = "Width",
            Value = 1920,
            Minimum = 1,
            Maximum = 16384,
            SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact,
            Margin = new Thickness(0, 0, 8, 12)
        };
        _widthBox.ValueChanged += (s, e) => ExportWidth = (int)e.NewValue;

        _heightBox = new NumberBox
        {
            Header = "Height",
            Value = 1080,
            Minimum = 1,
            Maximum = 16384,
            SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact,
            Margin = new Thickness(0, 0, 0, 12)
        };
        _heightBox.ValueChanged += (s, e) => ExportHeight = (int)e.NewValue;

        var sizePanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8
        };
        sizePanel.Children.Add(_widthBox);
        sizePanel.Children.Add(_heightBox);

        _backgroundToggle = new ToggleSwitch
        {
            Header = "Include Background",
            IsOn = true,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _backgroundToggle.Toggled += (s, e) => IncludeBackground = _backgroundToggle.IsOn;

        _embedToggle = new ToggleSwitch
        {
            Header = "Embed Round-Trip Data",
            IsOn = false,
            Margin = new Thickness(0, 0, 0, 8)
        };
        _embedToggle.Toggled += (s, e) => EmbedData = _embedToggle.IsOn;

        var root = new StackPanel { Spacing = 4 };
        root.Children.Add(_formatSelector);
        root.Children.Add(sizePanel);
        root.Children.Add(_backgroundToggle);
        root.Children.Add(_embedToggle);

        Content = root;

        PrimaryButtonClick += (s, e) =>
        {
            ExportRequested?.Invoke(this, new ExportRequestedEventArgs(
                SelectedFormat, ExportWidth, ExportHeight, IncludeBackground, EmbedData));
        };
    }

    public void SetFormats(System.Collections.Generic.IEnumerable<(string Name, string Label, string MimeType)> formats)
    {
        _formatSelector.Items.Clear();
        foreach (var (name, label, _) in formats)
        {
            _formatSelector.Items.Add(new ComboBoxItem { Content = label, Tag = name });
        }
    }

    private static void OnPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((ClefDiagramExportDialog)d).UpdateVisual();

    private void UpdateVisual()
    {
        IsPrimaryButtonEnabled = !string.IsNullOrEmpty(SelectedFormat);
    }

    public record ExportRequestedEventArgs(string Format, int Width, int Height, bool IncludeBackground, bool EmbedData);
}
