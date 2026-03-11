// ============================================================
// Clef Surface WatchKit Widget — ViewToggle
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ViewToggleView: View {
    var modes: [String] = ["list", "grid"]; @Binding var selectedMode: String
    var body: some View {
        HStack(spacing: 4) { ForEach(modes, id: \.self) { mode in Button(action: { selectedMode = mode }) { Image(systemName: mode == "list" ? "list.bullet" : "square.grid.2x2").font(.caption).foregroundColor(selectedMode == mode ? .accentColor : .secondary) } } }
    }
}
