using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class PromptInput : UserControl
    {
        private string _state = "empty";

        public PromptInput()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Auto-expanding textarea for composing LL");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
