using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class TaskPlanList : UserControl
    {
        private string _state = "idle";

        public TaskPlanList()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Goal decomposition display showing a hie");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
