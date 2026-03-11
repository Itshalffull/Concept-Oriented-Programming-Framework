// ============================================================
// Clef Surface WatchKit Widget - ViewSwitcher
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ViewSwitcherView: View {
    var options: [(id: String, icon: String, label: String)] = []; @Binding var selectedId: String
    var body: some View {
        HStack(spacing: 4) { ForEach(options, id: \.id) { opt in
            Button(action: { selectedId = opt.id }) {
                Image(systemName: opt.icon).font(.caption).foregroundColor(selectedId == opt.id ? .accentColor : .secondary)
            }
        } }
    }
}
