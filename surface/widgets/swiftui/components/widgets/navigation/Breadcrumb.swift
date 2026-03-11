// ============================================================
// Clef Surface SwiftUI Widget — Breadcrumb
//
// Hierarchical location trail rendered as a horizontal path
// with separator characters between items.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct BreadcrumbItem: Identifiable {
    let id = UUID()
    let label: String
    var href: String? = nil
    var current: Bool? = nil
}

// --------------- Component ---------------

/// Breadcrumb view rendering a hierarchical location trail.
///
/// - Parameters:
///   - items: Ordered breadcrumb trail items.
///   - separator: Separator character between items.
///   - onItemClick: Callback when a non-current item is clicked.
struct BreadcrumbView: View {
    var items: [BreadcrumbItem]
    var separator: String = "\u{203A}"
    var onItemClick: ((BreadcrumbItem) -> Void)? = nil

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                let isLast = index == items.count - 1
                let isCurrent = item.current ?? isLast

                if isCurrent {
                    Text(item.label)
                        .font(.body)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                } else {
                    SwiftUI.Button(action: {
                        onItemClick?(item)
                    }) {
                        Text(item.label)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }

                if !isLast {
                    Text(" \(separator) ")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 4)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}
