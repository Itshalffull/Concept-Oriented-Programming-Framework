// ============================================================
// Clef Surface WatchKit Widget — Pagination
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PaginationView: View {
    @Binding var currentPage: Int; var totalPages: Int
    var body: some View {
        HStack {
            Button(action: { if currentPage > 1 { currentPage -= 1 } }) { Image(systemName: "chevron.left") }.disabled(currentPage <= 1)
            Text("\(currentPage)/\(totalPages)").font(.caption2.monospacedDigit())
            Button(action: { if currentPage < totalPages { currentPage += 1 } }) { Image(systemName: "chevron.right") }.disabled(currentPage >= totalPages)
        }
    }
}
