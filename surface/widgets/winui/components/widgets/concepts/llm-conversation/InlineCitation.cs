using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI;
using System;

namespace Clef.Surface.Widgets.Concepts.LlmConversation
{
    public sealed partial class InlineCitation : UserControl
    {
        private enum WidgetState { Idle, Hovered, Expanded }
        private enum WidgetEvent { Hover, Leave, Toggle }

        private WidgetState _state = WidgetState.Idle;
        private readonly StackPanel _root;
        private readonly Border _badge;
        private readonly TextBlock _numberText;
        private readonly Border _tooltip;
        private readonly StackPanel _tooltipContent;
        private readonly TextBlock _sourceTitle;
        private readonly TextBlock _sourceUrl;
        private readonly TextBlock _snippet;
        private readonly TextBlock _relevanceScore;

        public event Action OnClick;

        public InlineCitation()
        {
            _root = new StackPanel { Orientation = Orientation.Vertical, Spacing = 0 };

            // Citation badge
            _badge = new Border
            {
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(6, 2, 6, 2),
                Background = new SolidColorBrush(Colors.DodgerBlue),
                HorizontalAlignment = HorizontalAlignment.Left
            };
            _numberText = new TextBlock
            {
                Text = "1",
                FontSize = 11,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold,
                Foreground = new SolidColorBrush(Colors.White)
            };
            _badge.Child = _numberText;
            _badge.PointerEntered += (s, e) => Send(WidgetEvent.Hover);
            _badge.PointerExited += (s, e) => Send(WidgetEvent.Leave);
            _badge.PointerPressed += (s, e) =>
            {
                Send(WidgetEvent.Toggle);
                OnClick?.Invoke();
            };
            _root.Children.Add(_badge);

            // Tooltip / expanded card
            _tooltip = new Border
            {
                Padding = new Thickness(10),
                CornerRadius = new CornerRadius(4),
                BorderThickness = new Thickness(1),
                BorderBrush = new SolidColorBrush(Colors.Gray),
                Visibility = Visibility.Collapsed,
                MaxWidth = 300
            };
            _tooltipContent = new StackPanel { Orientation = Orientation.Vertical, Spacing = 4 };
            _sourceTitle = new TextBlock { Text = "", FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, TextWrapping = TextWrapping.Wrap };
            _sourceUrl = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6, TextTrimming = TextTrimming.CharacterEllipsis };
            _snippet = new TextBlock { Text = "", FontSize = 12, TextWrapping = TextWrapping.Wrap, MaxLines = 3 };
            _relevanceScore = new TextBlock { Text = "", FontSize = 11, Opacity = 0.6 };
            _tooltipContent.Children.Add(_sourceTitle);
            _tooltipContent.Children.Add(_sourceUrl);
            _tooltipContent.Children.Add(_snippet);
            _tooltipContent.Children.Add(_relevanceScore);
            _tooltip.Child = _tooltipContent;
            _root.Children.Add(_tooltip);

            this.Content = _root;
            AutomationProperties.SetName(this, "Numbered inline citation reference");
        }

        public void SetCitation(int number, string title, string url, string snippet = null, double? relevance = null)
        {
            _numberText.Text = number.ToString();
            _sourceTitle.Text = title;
            _sourceUrl.Text = url;
            _snippet.Text = snippet ?? "";
            _snippet.Visibility = string.IsNullOrEmpty(snippet) ? Visibility.Collapsed : Visibility.Visible;
            _relevanceScore.Text = relevance.HasValue ? $"Relevance: {relevance.Value:P0}" : "";
            _relevanceScore.Visibility = relevance.HasValue ? Visibility.Visible : Visibility.Collapsed;
            AutomationProperties.SetName(_badge, $"Citation {number}: {title}");
        }

        public void Send(WidgetEvent evt)
        {
            _state = Reduce(_state, evt);
            _tooltip.Visibility = _state != WidgetState.Idle ? Visibility.Visible : Visibility.Collapsed;
        }

        private WidgetState Reduce(WidgetState state, WidgetEvent evt) => state switch
        {
            WidgetState.Idle when evt == WidgetEvent.Hover => WidgetState.Hovered,
            WidgetState.Idle when evt == WidgetEvent.Toggle => WidgetState.Expanded,
            WidgetState.Hovered when evt == WidgetEvent.Leave => WidgetState.Idle,
            WidgetState.Hovered when evt == WidgetEvent.Toggle => WidgetState.Expanded,
            WidgetState.Expanded when evt == WidgetEvent.Toggle => WidgetState.Idle,
            WidgetState.Expanded when evt == WidgetEvent.Leave => WidgetState.Idle,
            _ => state
        };
    }
}
