using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ExecutionMetricsPanel : UserControl
    {
        private string _state = "idle";

        public ExecutionMetricsPanel()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Dashboard panel displaying LLM execution");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
