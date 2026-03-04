// ============================================================
// Clef Surface WatchKit Widget — Toast
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ToastView: View {
    var message: String; var variant: String = "info"
    private var color: Color { switch variant { case "success": return .green; case "error": return .red; default: return .gray } }
    var body: some View {
        Text(message).font(.caption2).padding(8).background(color.opacity(0.9)).foregroundColor(.white).cornerRadius(8)
    }
}
