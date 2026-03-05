using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class GenerationIndicator : UserControl
    {
        private string _state = "idle";

        public GenerationIndicator()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Status indicator for LLM generation in p");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
