import SwiftUI

enum RunListTableWidgetState {
    case idle, rowSelected
}

enum RunListTableEvent {
    case selectRow, sort, filter, page, deselect
}

func runListTableReduce(state: RunListTableWidgetState, event: RunListTableEvent) -> RunListTableWidgetState {
    switch state {
    case .idle:
        if event == .selectRow { return .rowSelected }
        return state
    case .rowSelected:
        if event == .deselect { return .idle }
        if event == .selectRow { return .rowSelected }
        return state
    }
}

struct ProcessRun: Identifiable {
    var id: String
    var processName: String
    var status: String // "running", "completed", "failed", "cancelled", "pending"
    var startedAt: String
    var duration: String? = nil
    var outcome: String? = nil // "success", "failure", "cancelled", "pending"
}

struct RunListTableView: View {
    var runs: [ProcessRun]
    var pageSize: Int = 20
    var sortBy: String = "startedAt"
    var sortOrder: String = "desc"
    var filterStatus: String? = nil
    var onSelect: ((ProcessRun) -> Void)? = nil
    var onCancel: ((String) -> Void)? = nil

    @State private var widgetState: RunListTableWidgetState = .idle
    @State private var selectedId: String? = nil
    @State private var sortByCol: String = "startedAt"
    @State private var sortOrd: String = "desc"
    @State private var activeFilter: String? = nil
    @State private var currentPage: Int = 0
    @State private var focusIndex: Int = 0

    private let allStatuses = ["running", "pending", "completed", "failed", "cancelled"]
    private let statusLabels: [String: String] = [
        "running": "Running", "completed": "Completed", "failed": "Failed",
        "cancelled": "Cancelled", "pending": "Pending"
    ]
    private let statusOrder: [String: Int] = [
        "running": 0, "pending": 1, "completed": 2, "failed": 3, "cancelled": 4
    ]

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "running": return .blue
        case "completed": return .green
        case "failed": return .red
        case "cancelled": return .gray
        case "pending": return .orange
        default: return .secondary
        }
    }

    private func outcomeIcon(_ outcome: String?) -> String {
        switch outcome {
        case "success": return "\u{2713}"
        case "failure": return "\u{2717}"
        case "cancelled": return "\u{2014}"
        default: return "\u{25CB}"
        }
    }

    private var filteredRuns: [ProcessRun] {
        guard let filter = activeFilter else { return runs }
        return runs.filter { $0.status == filter }
    }

    private var sortedRuns: [ProcessRun] {
        filteredRuns.sorted { a, b in
            let cmp: Int
            switch sortByCol {
            case "processName": cmp = a.processName.compare(b.processName).rawValue
            case "status": cmp = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
            case "startedAt": cmp = a.startedAt.compare(b.startedAt).rawValue
            case "duration": cmp = (a.duration ?? "").compare(b.duration ?? "").rawValue
            default: cmp = 0
            }
            return sortOrd == "desc" ? cmp > 0 : cmp < 0
        }
    }

    private var totalPages: Int { max(1, Int(ceil(Double(sortedRuns.count) / Double(pageSize)))) }
    private var pageRuns: [ProcessRun] {
        let start = currentPage * pageSize
        let end = min(start + pageSize, sortedRuns.count)
        guard start < sortedRuns.count else { return [] }
        return Array(sortedRuns[start..<end])
    }

    private func sortIndicator(_ col: String) -> String {
        guard sortByCol == col else { return "" }
        return sortOrd == "asc" ? " \u{25B2}" : " \u{25BC}"
    }

    private func handleSort(_ column: String) {
        if sortByCol == column {
            sortOrd = sortOrd == "asc" ? "desc" : "asc"
        } else {
            sortByCol = column
            sortOrd = "asc"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Filter bar
            HStack(spacing: 4) {
                Button("All (\(runs.count))") {
                    activeFilter = nil
                    currentPage = 0
                }
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(activeFilter == nil ? Color.accentColor.opacity(0.15) : Color.clear)
                .cornerRadius(8)

                ForEach(allStatuses, id: \.self) { s in
                    let count = runs.filter { $0.status == s }.count
                    if count > 0 {
                        Button("\(statusLabels[s] ?? s) (\(count))") {
                            activeFilter = activeFilter == s ? nil : s
                            currentPage = 0
                        }
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(activeFilter == s ? statusColor(s).opacity(0.15) : Color.clear)
                        .cornerRadius(8)
                        .accessibilityLabel("\(statusLabels[s] ?? s), \(count)")
                    }
                }
            }

            // Table header
            HStack {
                ForEach(["status", "processName", "startedAt", "duration", "outcome"], id: \.self) { col in
                    let label: String = {
                        switch col {
                        case "processName": return "Process"
                        case "startedAt": return "Started"
                        default: return col.prefix(1).uppercased() + col.dropFirst()
                        }
                    }()
                    Button("\(label)\(sortIndicator(col))") {
                        handleSort(col)
                    }
                    .font(.caption)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, 8)

            Divider()

            // Rows
            if pageRuns.isEmpty {
                Text("No runs match the current filter")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(pageRuns.enumerated()), id: \.element.id) { index, run in
                        HStack {
                            Text(statusLabels[run.status] ?? run.status)
                                .font(.caption)
                                .foregroundColor(statusColor(run.status))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityLabel("Status: \(run.status)")

                            Text(run.processName)
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text(run.startedAt)
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text(run.duration ?? "\u{2014}")
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text(outcomeIcon(run.outcome))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityLabel("Outcome: \(run.outcome ?? "pending")")
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(selectedId == run.id ? Color.accentColor.opacity(0.1) : (index % 2 == 0 ? Color.clear : Color.gray.opacity(0.05)))
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedId = run.id
                            widgetState = runListTableReduce(state: widgetState, event: .selectRow)
                            onSelect?(run)
                        }
                    }
                }
            }

            // Pagination
            if totalPages > 1 {
                HStack {
                    Button("\u{2190}") {
                        currentPage = max(0, currentPage - 1)
                        focusIndex = 0
                    }
                    .disabled(currentPage == 0)
                    .accessibilityLabel("Previous page")

                    Spacer()

                    Text("Page \(currentPage + 1) of \(totalPages)")
                        .font(.caption)

                    Spacer()

                    Button("\u{2192}") {
                        currentPage = min(totalPages - 1, currentPage + 1)
                        focusIndex = 0
                    }
                    .disabled(currentPage >= totalPages - 1)
                    .accessibilityLabel("Next page")
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Process runs")
        .onAppear {
            sortByCol = sortBy
            sortOrd = sortOrder
            activeFilter = filterStatus
        }
    }
}
