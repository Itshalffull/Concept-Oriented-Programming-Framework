import SwiftUI

// State machine: idle | cellSelected (no hover on watch)
enum StatusGridWatchState {
    case idle
    case cellSelected
}

enum StatusGridWatchEvent {
    case selectCell(Int)
    case filter
    case deselect
}

func statusGridWatchReduce(_ state: StatusGridWatchState, _ event: StatusGridWatchEvent) -> StatusGridWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectCell: return .cellSelected
        case .filter: return .idle
        default: return state
        }
    case .cellSelected:
        switch event {
        case .deselect: return .idle
        case .selectCell: return .cellSelected
        default: return state
        }
    }
}

struct StatusGridItem: Identifiable {
    let id: String
    let name: String
    let status: String // "passed", "failed", "running", "pending", "timeout"
    var duration: Int? = nil // milliseconds
}

struct StatusGridWatchView: View {
    let items: [StatusGridItem]
    var onCellSelect: ((StatusGridItem) -> Void)? = nil

    @State private var state: StatusGridWatchState = .idle
    @State private var selectedIndex: Int? = nil
    @State private var filter: String = "all"

    private var filteredItems: [StatusGridItem] {
        if filter == "all" { return items }
        return items.filter { $0.status == filter }
    }

    private var counts: (passed: Int, failed: Int, running: Int) {
        (
            items.filter { $0.status == "passed" }.count,
            items.filter { $0.status == "failed" }.count,
            items.filter { $0.status == "running" }.count
        )
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "passed": return .green
        case "failed": return .red
        case "running": return .blue
        case "pending": return .secondary
        case "timeout": return .orange
        default: return .primary
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "passed": return "\u{2713}"
        case "failed": return "\u{2717}"
        case "running": return "\u{25CB}"
        case "pending": return "\u{23F3}"
        case "timeout": return "\u{23F1}"
        default: return "\u{2022}"
        }
    }

    private func formatDuration(_ ms: Int) -> String {
        ms < 1000 ? "\(ms)ms" : String(format: "%.1fs", Double(ms) / 1000.0)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Summary
                HStack(spacing: 6) {
                    HStack(spacing: 2) {
                        Circle().fill(.green).frame(width: 6, height: 6)
                        Text("\(counts.passed)").font(.system(size: 9))
                    }
                    HStack(spacing: 2) {
                        Circle().fill(.red).frame(width: 6, height: 6)
                        Text("\(counts.failed)").font(.system(size: 9))
                    }
                    if counts.running > 0 {
                        HStack(spacing: 2) {
                            Circle().fill(.blue).frame(width: 6, height: 6)
                            Text("\(counts.running)").font(.system(size: 9))
                        }
                    }
                }

                // Filter
                Picker("Filter", selection: $filter) {
                    Text("All").tag("all")
                    Text("Pass").tag("passed")
                    Text("Fail").tag("failed")
                }
                .pickerStyle(.segmented)
                .font(.caption2)

                // Grid as compact list
                ForEach(Array(filteredItems.enumerated()), id: \.element.id) { index, item in
                    Button {
                        selectedIndex = index
                        state = statusGridWatchReduce(state, .selectCell(index))
                        onCellSelect?(item)
                    } label: {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(statusColor(item.status))
                                .frame(width: 8, height: 8)
                            Text(item.name)
                                .font(.caption2)
                                .lineLimit(1)
                            Spacer()
                            if let dur = item.duration {
                                Text(formatDuration(dur))
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                        .background(selectedIndex == index ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)
                }

                // Selected detail
                if let idx = selectedIndex, idx < filteredItems.count {
                    let item = filteredItems[idx]
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name).font(.caption2).fontWeight(.bold)
                        HStack(spacing: 4) {
                            Circle().fill(statusColor(item.status)).frame(width: 8, height: 8)
                            Text(item.status.capitalized).font(.caption2)
                        }
                        if let dur = item.duration {
                            Text("Duration: \(formatDuration(dur))").font(.system(size: 9)).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Verification status grid with \(items.count) items")
    }
}
