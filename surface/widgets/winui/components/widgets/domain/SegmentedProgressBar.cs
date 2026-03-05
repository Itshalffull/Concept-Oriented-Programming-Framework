using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class SegmentedProgressBar : UserControl
    {
        private string _state = "idle";

        public SegmentedProgressBar()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Horizontal progress bar divided into col");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
