import SwiftUI

// MARK: - Types

enum CoverageStatus: String, CaseIterable {
    case covered
    case uncovered
    case partial
}

enum CoverageFilter: String, CaseIterable {
    case all
    case covered
    case uncovered
    case partial

    var displayName: String { rawValue.capitalized }
}

struct CoverageLine: Identifiable {
    let id: Int
    let number: Int
    let text: String
    let coverage: CoverageStatus?
    var coveredBy: String?
}

struct CoverageSummary {
    let totalLines: Int
    let coveredLines: Int
    let percentage: Double
}

// MARK: - State Machine

enum CoverageSourceViewState {
    case idle
    case lineHovered
}

enum CoverageSourceViewEvent {
    case hoverLine(lineIndex: Int)
    case filter(status: CoverageFilter)
    case jumpUncovered
    case leave
    case selectLine(lineIndex: Int)
}

func coverageSourceViewReduce(state: CoverageSourceViewState, event: CoverageSourceViewEvent) -> CoverageSourceViewState {
    switch state {
    case .idle:
        switch event {
        case .hoverLine: return .lineHovered
        case .filter, .jumpUncovered: return .idle
        default: return state
        }
    case .lineHovered:
        switch event {
        case .leave: return .idle
        default: return state
        }
    }
}

// MARK: - View

struct CoverageSourceViewView: View {
    let lines: [CoverageLine]
    let summary: CoverageSummary
    var language: String = "typescript"
    var showLineNumbers: Bool = true
    var filterStatus: CoverageFilter = .all
    var onLineSelect: ((CoverageLine) -> Void)?
    var onFilterChange: ((CoverageFilter) -> Void)?

    @State private var widgetState: CoverageSourceViewState = .idle
    @State private var selectedLineIndex: Int? = nil
    @State private var focusedLineIndex: Int = 0
    @State private var hoveredLineIndex: Int? = nil
    @State private var activeFilter: CoverageFilter = .all

    private var filteredLines: [CoverageLine] {
        if activeFilter == .all { return lines }
        return lines.filter { $0.coverage?.rawValue == activeFilter.rawValue }
    }

    private func gutterColor(for status: CoverageStatus?) -> Color {
        switch status {
        case .covered: return .green
        case .uncovered: return .red
        case .partial: return .yellow
        case nil: return .clear
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Summary header
            HStack {
                Text("Coverage: \(Int(summary.percentage))% (\(summary.coveredLines)/\(summary.totalLines) lines)")
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
            }
            .accessibilityLabel("Coverage \(Int(summary.percentage)) percent, \(summary.coveredLines) of \(summary.totalLines) lines")

            Divider()

            // Filter bar
            HStack(spacing: 4) {
                ForEach(CoverageFilter.allCases, id: \.self) { filter in
                    Button(action: {
                        activeFilter = filter
                        focusedLineIndex = 0
                        selectedLineIndex = nil
                        widgetState = coverageSourceViewReduce(state: widgetState, event: .filter(status: filter))
                        onFilterChange?(filter)
                    }) {
                        Text(filter.displayName)
                            .font(.system(size: 12))
                            .fontWeight(activeFilter == filter ? .semibold : .regular)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 2)
                            .background(activeFilter == filter ? Color.blue.opacity(0.15) : Color.clear)
                            .cornerRadius(4)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color.gray.opacity(0.4), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(activeFilter == filter ? .isSelected : [])
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)

            Divider()

            // Code area
            ScrollView(.vertical) {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(filteredLines.enumerated()), id: \.element.id) { index, line in
                        HStack(alignment: .top, spacing: 0) {
                            // Coverage gutter
                            Rectangle()
                                .fill(gutterColor(for: line.coverage))
                                .frame(width: 4)

                            // Line number
                            if showLineNumbers {
                                Text("\(line.number)")
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundColor(.gray)
                                    .frame(width: 48, alignment: .trailing)
                                    .padding(.trailing, 12)
                            }

                            // Source text
                            Text(line.text)
                                .font(.system(size: 13, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.trailing, 12)
                        }
                        .background(
                            selectedLineIndex == index ? Color.blue.opacity(0.15) :
                            focusedLineIndex == index ? Color.gray.opacity(0.08) :
                            hoveredLineIndex == index ? Color.gray.opacity(0.04) :
                            Color.clear
                        )
                        .overlay(
                            focusedLineIndex == index ?
                                RoundedRectangle(cornerRadius: 0).stroke(Color.indigo, lineWidth: 2) : nil
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedLineIndex = index
                            onLineSelect?(line)
                        }
                        .onHover { isHovered in
                            if isHovered {
                                hoveredLineIndex = index
                                widgetState = coverageSourceViewReduce(state: widgetState, event: .hoverLine(lineIndex: index))
                            } else {
                                hoveredLineIndex = nil
                                widgetState = coverageSourceViewReduce(state: widgetState, event: .leave)
                            }
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Line \(line.number), \(line.coverage?.rawValue ?? "not executable"), \(line.text)")
                    }
                }
            }
            .frame(minHeight: 100)

            // Tooltip
            if widgetState == .lineHovered,
               let hIdx = hoveredLineIndex,
               hIdx < filteredLines.count,
               let coveredBy = filteredLines[hIdx].coveredBy {
                Text("Covered by: \(coveredBy)")
                    .font(.system(size: 12))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.darkGray))
                    .foregroundColor(.white)
                    .cornerRadius(4)
                    .padding(8)
            }

            // Selected line details
            if let selIdx = selectedLineIndex, selIdx < filteredLines.count {
                let line = filteredLines[selIdx]
                Divider()
                HStack {
                    Text("Line \(line.number)")
                        .fontWeight(.bold)
                    Text(" - ")
                    Text(line.coverage?.rawValue.capitalized ?? "Not executable")
                    if let coveredBy = line.coveredBy {
                        Text(" (covered by: \(coveredBy))")
                    }
                }
                .font(.system(size: 13))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Coverage source view")
        .onChange(of: filterStatus) { newValue in
            activeFilter = newValue
        }
    }
}
