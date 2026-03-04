// ============================================================
// Clef Surface SwiftUI Widget — DataTable
//
// Sortable data table with configurable columns, row selection,
// and header sort indicators.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct DataTableColumn: Identifiable {
    let id: String
    let key: String
    let label: String
    var width: CGFloat = 120
    var sortable: Bool = false

    init(key: String, label: String, width: CGFloat = 120, sortable: Bool = false) {
        self.id = key
        self.key = key
        self.label = label
        self.width = width
        self.sortable = sortable
    }
}

enum SortDirection { case ascending, descending, none }

// --------------- Component ---------------

/// DataTable view with sortable columns and optional row selection.
///
/// - Parameters:
///   - columns: Column definitions.
///   - data: Row data as dictionaries keyed by column key.
///   - sortColumn: Currently sorted column key.
///   - sortDirection: Current sort direction.
///   - selectable: Whether rows are selectable.
///   - loading: Whether data is loading.
///   - emptyMessage: Message shown when data is empty.
///   - onSort: Callback when a column header is tapped.
///   - onSelectRow: Callback when a row selection changes.
struct DataTableView: View {
    var columns: [DataTableColumn]
    var data: [[String: String]]
    var sortColumn: String? = nil
    var sortDirection: SortDirection = .none
    var selectable: Bool = false
    var loading: Bool = false
    var emptyMessage: String = "No data available"
    var onSort: ((String, SortDirection) -> Void)? = nil
    var onSelectRow: ((Int, Bool) -> Void)? = nil

    @State private var selectedRows: Set<Int> = []

    var body: some View {
        if loading {
            HStack {
                Spacer()
                Text("Loading...")
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding(16)
        } else if data.isEmpty {
            HStack {
                Spacer()
                Text(emptyMessage)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding(16)
        } else {
            ScrollView(.horizontal) {
                VStack(spacing: 0) {
                    // Header
                    HStack(spacing: 0) {
                        if selectable {
                            Spacer().frame(width: 48)
                        }
                        ForEach(columns) { col in
                            SwiftUI.Button(action: {
                                guard col.sortable else { return }
                                let newDir: SortDirection = (sortColumn == col.key && sortDirection == .ascending)
                                    ? .descending : .ascending
                                onSort?(col.key, newDir)
                            }) {
                                HStack(spacing: 4) {
                                    Text(col.label)
                                        .font(.subheadline)
                                        .fontWeight(.bold)
                                    if col.sortable && sortColumn == col.key {
                                        Image(systemName: sortDirection == .ascending ? "arrow.up" : "arrow.down")
                                            .font(.caption2)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .frame(width: col.width, alignment: .leading)
                        }
                    }
                    .padding(.vertical, 8)

                    Divider()

                    // Data rows
                    ForEach(Array(data.enumerated()), id: \.offset) { rowIndex, row in
                        HStack(spacing: 0) {
                            if selectable {
                                let isSelected = selectedRows.contains(rowIndex)
                                SwiftUI.Button(action: {
                                    if isSelected {
                                        selectedRows.remove(rowIndex)
                                    } else {
                                        selectedRows.insert(rowIndex)
                                    }
                                    onSelectRow?(rowIndex, !isSelected)
                                }) {
                                    Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                                        .foregroundColor(.accentColor)
                                }
                                .buttonStyle(.plain)
                                .frame(width: 48)
                            }

                            ForEach(columns) { col in
                                Text(row[col.key] ?? "")
                                    .font(.body)
                                    .lineLimit(1)
                                    .frame(width: col.width, alignment: .leading)
                            }
                        }
                        .padding(.vertical, 8)

                        if rowIndex < data.count - 1 {
                            Divider()
                        }
                    }
                }
            }
        }
    }
}
