// ============================================================
// Clef Surface WatchKit Widget — Alert
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct AlertView: View {
    var title: String = ""; var message: String = ""; var variant: String = "info"
    private var color: Color { switch variant { case "success": return .green; case "warning": return .orange; case "error": return .red; default: return .blue } }
    private var icon: String { switch variant { case "success": return "checkmark.circle.fill"; case "warning": return "exclamationmark.triangle.fill"; case "error": return "xmark.octagon.fill"; default: return "info.circle.fill" } }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) { Image(systemName: icon).foregroundColor(color).font(.caption); Text(title).font(.caption.bold()) }
            Text(message).font(.caption2).foregroundColor(.secondary)
        }.padding(8).background(color.opacity(0.1)).cornerRadius(8)
    }
}
