using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class PromptTemplateEditor : UserControl
    {
        private string _state = "editing";

        public PromptTemplateEditor()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Multi-message prompt template editor wit");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
