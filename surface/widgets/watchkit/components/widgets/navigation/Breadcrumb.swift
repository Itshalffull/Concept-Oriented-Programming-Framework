// ============================================================
// Clef Surface WatchKit Widget — Breadcrumb
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct BreadcrumbView: View {
    var crumbs: [(label: String, action: () -> Void)]
    var body: some View {
        ScrollView(.horizontal) { HStack(spacing: 4) { ForEach(0..<crumbs.count, id: \.self) { i in
            if i > 0 { Text("/").font(.caption2).foregroundColor(.secondary) }
            Button(crumbs[i].label, action: crumbs[i].action).font(.caption2).foregroundColor(i == crumbs.count - 1 ? .primary : .accentColor)
        } } }
    }
}
