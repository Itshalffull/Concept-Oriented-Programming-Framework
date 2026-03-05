using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class SlaTimer : UserControl
    {
        private string _state = "onTrack";

        public SlaTimer()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Five-state countdown timer for service l");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
