// ============================================================
// Clef Surface SwiftUI Widget — ToggleSwitch
//
// Binary on/off toggle control using SwiftUI Toggle with an
// optional label.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// ToggleSwitch view for binary on/off toggle control.
///
/// - Parameters:
///   - checked: Binding to the toggle state.
///   - label: Optional label text.
///   - enabled: Whether the toggle is enabled.
struct ToggleSwitchView: View {
    @Binding var checked: Bool
    var label: String? = nil
    var enabled: Bool = true

    var body: some View {
        Toggle(isOn: $checked) {
            if let label = label {
                Text(label)
                    .font(.body)
                    .foregroundColor(enabled ? .primary : .gray)
            }
        }
        .toggleStyle(.switch)
        .disabled(!enabled)
        .accessibilityLabel(label ?? "Toggle")
    }
}
