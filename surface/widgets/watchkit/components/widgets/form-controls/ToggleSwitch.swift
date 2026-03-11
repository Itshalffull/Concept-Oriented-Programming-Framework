// ============================================================
// Clef Surface WatchKit Widget — ToggleSwitch
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ToggleSwitchView: View {
    var label: String = ""; @Binding var isOn: Bool
    var body: some View { Toggle(label, isOn: $isOn).font(.caption2) }
}
