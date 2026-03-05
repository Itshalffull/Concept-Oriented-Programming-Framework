using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class PromptEditor : UserControl
    {
        private string _state = "editing";

        public PromptEditor()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Multi-message prompt template editor for");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
