using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ApprovalStepper : UserControl
    {
        private string _state = "viewing";

        public ApprovalStepper()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Multi-step approval flow visualization s");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
