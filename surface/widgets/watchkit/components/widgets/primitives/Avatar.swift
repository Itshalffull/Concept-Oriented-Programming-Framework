// ============================================================
// Clef Surface WatchKit Widget — Avatar
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct AvatarView: View {
    var name: String = ""
    var size: CGFloat = 32
    private var initials: String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 { return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased() }
        return String(name.prefix(2)).uppercased()
    }
    var body: some View {
        ZStack {
            Circle().fill(Color.accentColor.opacity(0.2)).frame(width: size, height: size)
            Text(initials).font(.system(size: size * 0.35, weight: .bold))
        }
    }
}
