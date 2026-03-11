// ============================================================
// Clef Surface SwiftUI Widget — PermissionMatrix
//
// Grid-based permission assignment matrix with roles as columns
// and resources as rows. Toggle checkmarks at intersections.
// ============================================================

import SwiftUI

struct PermissionMatrixView: View {
    var roles: [String]
    var resources: [String]
    @Binding var permissions: [[Bool]]

    var body: some View {
        ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
                // Header row
                HStack(spacing: 0) {
                    Text("Resource").font(.subheadline).fontWeight(.bold).frame(width: 120, alignment: .leading)
                    ForEach(roles, id: \.self) { role in
                        Text(role).font(.caption).fontWeight(.bold).frame(width: 80)
                    }
                }.padding(.vertical, 8)
                Divider()
                // Data rows
                ForEach(Array(resources.enumerated()), id: \.offset) { rIdx, resource in
                    HStack(spacing: 0) {
                        Text(resource).font(.subheadline).frame(width: 120, alignment: .leading)
                        ForEach(Array(roles.enumerated()), id: \.offset) { cIdx, _ in
                            SwiftUI.Button(action: {
                                if rIdx < permissions.count && cIdx < permissions[rIdx].count {
                                    permissions[rIdx][cIdx].toggle()
                                }
                            }) {
                                let checked = rIdx < permissions.count && cIdx < permissions[rIdx].count ? permissions[rIdx][cIdx] : false
                                Image(systemName: checked ? "checkmark.square.fill" : "square").foregroundColor(.accentColor)
                            }.buttonStyle(.plain).frame(width: 80)
                        }
                    }.padding(.vertical, 4)
                    if rIdx < resources.count - 1 { Divider() }
                }
            }
        }
    }
}
