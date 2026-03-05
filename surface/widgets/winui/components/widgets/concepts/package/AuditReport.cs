using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class AuditReport : UserControl
    {
        private string _state = "idle";

        public AuditReport()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Security audit report panel showing vuln");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
