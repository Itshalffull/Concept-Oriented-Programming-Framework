// ============================================================
// Clef Surface WatchKit Widget - PermissionMatrix
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PermissionMatrixView: View {
    var roles: [String] = []; var permissions: [String] = []; var granted: [[Bool]] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            ForEach(0..<roles.count, id: \.self) { r in
                Text(roles[r]).font(.caption.bold())
                ForEach(0..<permissions.count, id: \.self) { p in
                    HStack { Text(permissions[p]).font(.caption2); Spacer()
                        Image(systemName: (r < granted.count && p < granted[r].count && granted[r][p]) ? "checkmark.circle.fill" : "circle").font(.caption2) }
                }
                Divider()
            }
        } }
    }
}
