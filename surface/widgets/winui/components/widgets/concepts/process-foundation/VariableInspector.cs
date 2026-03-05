using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class VariableInspector : UserControl
    {
        private string _state = "idle";

        public VariableInspector()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Key-value inspector panel for process ru");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
