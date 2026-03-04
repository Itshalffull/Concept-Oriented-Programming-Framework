// ============================================================
// Clef Surface WatchKit Widget — Tabs
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TabsView: View {
    var tabs: [(id: String, label: String, content: AnyView)]; @State var selectedTab: String = ""
    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal) { HStack(spacing: 8) { ForEach(tabs, id: \.id) { tab in
                Button(action: { selectedTab = tab.id }) { Text(tab.label).font(.caption2).foregroundColor(selectedTab == tab.id ? .accentColor : .secondary) }
            } } }
            ForEach(tabs, id: \.id) { tab in if tab.id == selectedTab { tab.content } }
        }.onAppear { if selectedTab.isEmpty, let first = tabs.first { selectedTab = first.id } }
    }
}
