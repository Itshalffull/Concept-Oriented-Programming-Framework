import SwiftUI

// State machine: idle | lineSelected (no hover on watch)
enum CoverageSourceViewWatchState {
    case idle
    case lineSelected
}

enum CoverageSourceViewWatchEvent {
    case selectLine(Int)
    case filter(String)
    case jumpUncovered
    case deselect
}

func coverageSourceViewWatchReduce(_ state: CoverageSourceViewWatchState, _ event: CoverageSourceViewWatchEvent) -> CoverageSourceViewWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectLine: return .lineSelected
        case .filter, .jumpUncovered: return .idle
        default: return state
        }
    case .lineSelected:
        switch event {
        case .deselect: return .idle
        case .selectLine: return .lineSelected
        default: return state
        }
    }
}

struct CoverageLine: Identifiable {
    let id = UUID()
    let number: Int
    let text: String
    let coverage: String? // "covered", "uncovered", "partial", nil
    let coveredBy: String?
}

struct CoverageSummary {
    let totalLines: Int
    let coveredLines: Int
    let percentage: Double
}

struct CoverageSourceViewWatchView: View {
    let lines: [CoverageLine]
    let summary: CoverageSummary
    var language: String = "typescript"
    var onLineSelect: ((CoverageLine) -> Void)? = nil

    @State private var state: CoverageSourceViewWatchState = .idle
    @State private var selectedLineIndex: Int? = nil
    @State private var activeFilter: String = "all"

    private var filteredLines: [CoverageLine] {
        if activeFilter == "all" { return lines }
        return lines.filter { $0.coverage == activeFilter }
    }

    private func gutterColor(for coverage: String?) -> Color {
        switch coverage {
        case "covered": return .green
        case "uncovered": return .red
        case "partial": return .yellow
        default: return .clear
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Summary
                Text("\(Int(summary.percentage))% coverage")
                    .font(.caption2)
                    .fontWeight(.semibold)
                Text("\(summary.coveredLines)/\(summary.totalLines) lines")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                // Filter picker
                Picker("Filter", selection: $activeFilter) {
                    Text("All").tag("all")
                    Text("Cov").tag("covered")
                    Text("Unc").tag("uncovered")
                    Text("Par").tag("partial")
                }
                .pickerStyle(.segmented)
                .font(.caption2)

                // Source lines
                ForEach(Array(filteredLines.enumerated()), id: \.element.id) { index, line in
                    Button {
                        selectedLineIndex = index
                        state = coverageSourceViewWatchReduce(state, .selectLine(index))
                        onLineSelect?(line)
                    } label: {
                        HStack(spacing: 2) {
                            Rectangle()
                                .fill(gutterColor(for: line.coverage))
                                .frame(width: 3)

                            Text("\(line.number)")
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.secondary)
                                .frame(width: 20, alignment: .trailing)

                            Text(line.text)
                                .font(.system(size: 9, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        .padding(.vertical, 1)
                        .background(selectedLineIndex == index ? Color.blue.opacity(0.2) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)
                }

                // Selected line detail
                if let idx = selectedLineIndex, idx < filteredLines.count {
                    let line = filteredLines[idx]
                    VStack(alignment: .leading, spacing: 2) {
                        Divider()
                        Text("Line \(line.number)")
                            .font(.caption2)
                            .fontWeight(.bold)
                        Text(line.coverage?.capitalized ?? "Not executable")
                            .font(.caption2)
                        if let coveredBy = line.coveredBy {
                            Text("By: \(coveredBy)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Source code coverage view showing \(language) coverage at \(Int(summary.percentage))%")
    }
}
