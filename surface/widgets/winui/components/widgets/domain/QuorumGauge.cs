using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class QuorumGauge : UserControl
    {
        private string _state = "belowThreshold";

        public QuorumGauge()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Progress bar with a threshold marker sho");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
