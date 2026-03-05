using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class GuardrailConfig : UserControl
    {
        private string _state = "viewing";

        public GuardrailConfig()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Configuration panel for safety guardrail");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
