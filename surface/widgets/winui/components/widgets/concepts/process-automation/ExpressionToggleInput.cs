using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ExpressionToggleInput : UserControl
    {
        private string _state = "fixed";

        public ExpressionToggleInput()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "Dual-mode input field that switches betw");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
