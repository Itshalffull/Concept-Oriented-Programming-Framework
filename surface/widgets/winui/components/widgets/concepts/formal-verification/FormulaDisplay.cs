using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Dispatching;

namespace Clef.Surface.Widgets.Concepts.FormalVerification
{
    /// <summary>
    /// Syntax-highlighted formula display with copy support
    /// </summary>
    public sealed partial class FormulaDisplay : UserControl, IDisposable
    {
        private enum WidgetState
        {
        Idle,
        Copied,
        Rendering
        }

        private enum WidgetEvent
        {
        COPY,
        RENDER_LATEX,
        TIMEOUT,
        RENDER_COMPLETE
        }

        private WidgetState _state = WidgetState.Idle;
        private DispatcherTimer? _timer;
        private bool _isExpanded = false;
        private readonly TextBlock _formulaText = new() { IsTextSelectionEnabled = true, FontFamily = new Microsoft.UI.Xaml.Media.FontFamily("Cascadia Code,Consolas,monospace") };
        private readonly Button _copyButton = new() { Content = "Copy" };
        private readonly TextBlock _statusText = new();

        // --- UI elements ---
        private readonly StackPanel _root;

        public FormulaDisplay()
        {
            _root = new StackPanel { Spacing = 4 };
            BuildUI();
            this.Content = _root;

            AutomationProperties.SetName(this, "Syntax-highlighted formula display with copy support");

            this.KeyDown += OnKeyDown;
        }

        private void BuildUI()
        {
            _root.Children.Clear();
            var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
            _copyButton.Click += (s, e) => { Send(WidgetEvent.COPY); CopyToClipboard(); };
            header.Children.Add(_copyButton);
            header.Children.Add(_statusText);
            _root.Children.Add(header);
            _root.Children.Add(_formulaText);
        }

        public void Send(WidgetEvent @event)
        {
            _state = Reduce(_state, @event);
            UpdateVisualState();
        }

        private static WidgetState Reduce(WidgetState state, WidgetEvent @event) => state switch
        {
            WidgetState.Idle => @event switch
            {
                WidgetEvent.COPY => WidgetState.Copied,
                WidgetEvent.RENDER_LATEX => WidgetState.Rendering,
                _ => state
            },
            WidgetState.Copied => @event switch
            {
                WidgetEvent.TIMEOUT => WidgetState.Idle,
                _ => state
            },
            WidgetState.Rendering => @event switch
            {
                WidgetEvent.RENDER_COMPLETE => WidgetState.Idle,
                _ => state
            },
            _ => state
        };

        private void UpdateVisualState()
        {
            // Update visual properties based on current _state
        }

        private void OnKeyDown(object sender, Microsoft.UI.Xaml.Input.KeyRoutedEventArgs e)
        {
            if (e.Key == Windows.System.VirtualKey.Escape)
            {
                // Context-specific escape handling
            }
        }

        private void CopyToClipboard()
        {
            var dp = new Windows.ApplicationModel.DataTransfer.DataPackage();
            dp.SetText(_formulaText.Text);
            Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(dp);
            _statusText.Text = "Copied!";
            _timer = new DispatcherTimer { Interval = System.TimeSpan.FromSeconds(2) };
            _timer.Tick += (s, e) => { _timer?.Stop(); Send(WidgetEvent.TIMEOUT); _statusText.Text = ""; };
            _timer.Start();
        }

        public void Dispose()
        {
            if (_timer != null) { _timer.Stop(); _timer = null; }
            this.KeyDown -= OnKeyDown;
        }
    }
}
