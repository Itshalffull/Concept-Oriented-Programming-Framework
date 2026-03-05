using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class EvalResultsTable : UserControl
    {
        private string _state = "idle";

        public EvalResultsTable()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Results table for LLM evaluation runs sh");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
