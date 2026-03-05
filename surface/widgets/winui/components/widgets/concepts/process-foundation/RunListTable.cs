using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class RunListTable : UserControl
    {
        private string _state = "idle";

        public RunListTable()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Table listing process runs with columns ");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
