// ============================================================
// Clef Surface WatchKit Widget — Badge
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct BadgeView: View {
    var value: String = ""
    var variant: String = "default"
    var dot: Bool = false
    private var color: Color {
        switch variant { case "success": return .green; case "warning": return .orange; case "error": return .red; default: return .accentColor }
    }
    var body: some View {
        if dot { Circle().fill(color).frame(width: 8, height: 8) }
        else { Text(value).font(.system(size: 10, weight: .medium)).foregroundColor(.white).padding(.horizontal, 6).padding(.vertical, 2).background(color).cornerRadius(10) }
    }
}
