// ============================================================
// Clef Surface SwiftUI Widget — Pagination
//
// Page navigation control displaying page numbers with
// previous/next buttons and optional ellipsis for large ranges.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Pagination view for page navigation control.
///
/// - Parameters:
///   - currentPage: Binding to the current page number (1-based).
///   - totalPages: Total number of pages.
///   - siblingCount: Number of sibling pages to show around current.
///   - onPageChange: Callback when the page changes.
struct PaginationView: View {
    @Binding var currentPage: Int
    var totalPages: Int
    var siblingCount: Int = 1
    var onPageChange: ((Int) -> Void)? = nil

    private var pages: [PageItem] {
        var result: [PageItem] = []
        let start = Swift.max(1, currentPage - siblingCount)
        let end = Swift.min(totalPages, currentPage + siblingCount)

        if start > 1 {
            result.append(.page(1))
            if start > 2 { result.append(.ellipsis) }
        }

        for i in start...end {
            result.append(.page(i))
        }

        if end < totalPages {
            if end < totalPages - 1 { result.append(.ellipsis) }
            result.append(.page(totalPages))
        }

        return result
    }

    var body: some View {
        HStack(spacing: 4) {
            // Previous button
            SwiftUI.Button(action: {
                let prev = currentPage - 1
                currentPage = prev
                onPageChange?(prev)
            }) {
                Image(systemName: "chevron.left")
            }
            .disabled(currentPage <= 1)

            // Page buttons
            ForEach(Array(pages.enumerated()), id: \.offset) { _, item in
                switch item {
                case .page(let num):
                    SwiftUI.Button(action: {
                        currentPage = num
                        onPageChange?(num)
                    }) {
                        Text("\(num)")
                            .font(.body)
                            .fontWeight(num == currentPage ? .bold : .regular)
                            .foregroundColor(num == currentPage ? .white : .primary)
                            .frame(minWidth: 36, minHeight: 36)
                            .background(num == currentPage ? Color.accentColor : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)

                case .ellipsis:
                    Text("...")
                        .foregroundColor(.secondary)
                        .frame(minWidth: 36, minHeight: 36)
                }
            }

            // Next button
            SwiftUI.Button(action: {
                let next = currentPage + 1
                currentPage = next
                onPageChange?(next)
            }) {
                Image(systemName: "chevron.right")
            }
            .disabled(currentPage >= totalPages)
        }
    }

    private enum PageItem {
        case page(Int)
        case ellipsis
    }
}
