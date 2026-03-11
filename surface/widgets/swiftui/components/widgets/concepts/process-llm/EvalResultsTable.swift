import SwiftUI

enum EvalResultsTableWidgetState {
    case idle, rowSelected
}

enum EvalResultsTableEvent {
    case selectRow, sort, filter, deselect
}

func evalResultsTableReduce(state: EvalResultsTableWidgetState, event: EvalResultsTableEvent) -> EvalResultsTableWidgetState {
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

struct EvalTestCase: Identifiable {
    var id: String
    var input: String
    var expected: String
    var actual: String
    var score: Double
    var pass: Bool
    var metrics: [String: Double]? = nil
}

struct EvalResultsTableView: View {
    var testCases: [EvalTestCase]
    var overallScore: Double
    var passCount: Int
    var failCount: Int
    var sortBy: String = "score"
    var sortOrder: String = "desc"
    var filterStatus: String? = nil
    var showExpected: Bool = true
    var onSelect: ((EvalTestCase) -> Void)? = nil

    @State private var widgetState: EvalResultsTableWidgetState = .idle
    @State private var selectedId: String? = nil
    @State private var sortByCol: String = "score"
    @State private var sortOrd: String = "desc"
    @State private var activeFilter: String? = nil
    @State private var focusIndex: Int = 0

    private func truncate(_ text: String, maxLength: Int) -> String {
        if text.count <= maxLength { return text }
        return String(text.prefix(maxLength - 3)) + "..."
    }

    private var filteredCases: [EvalTestCase] {
        guard let filter = activeFilter else { return testCases }
        if filter == "pass" { return testCases.filter { $0.pass } }
        if filter == "fail" { return testCases.filter { !$0.pass } }
        return testCases
    }

    private var sortedCases: [EvalTestCase] {
        filteredCases.sorted { a, b in
            let cmp: Int
            switch sortByCol {
            case "score": cmp = a.score < b.score ? -1 : (a.score > b.score ? 1 : 0)
            case "status": cmp = (a.pass ? 1 : 0) - (b.pass ? 1 : 0)
            case "input": cmp = a.input.compare(b.input).rawValue
            case "actual": cmp = a.actual.compare(b.actual).rawValue
            case "expected": cmp = a.expected.compare(b.expected).rawValue
            default: cmp = 0
            }
            return sortOrd == "desc" ? cmp > 0 : cmp < 0
        }
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
            sortOrd = "desc"
        }
    }

    private var totalCount: Int { passCount + failCount }
    private var passPercent: Double { totalCount > 0 ? Double(passCount) / Double(totalCount) * 100 : 0 }
    private var failPercent: Double { totalCount > 0 ? 100 - passPercent : 0 }

    private var selectedCase: EvalTestCase? {
        guard let id = selectedId else { return nil }
        return sortedCases.first { $0.id == id }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Summary bar
            HStack(spacing: 12) {
                Text("\(Int(overallScore))%")
                    .font(.title2)
                    .fontWeight(.bold)
                    .accessibilityLabel("Overall score: \(Int(overallScore)) percent")

                Text("\(passCount) passed")
                    .font(.caption)
                    .foregroundColor(.green)

                Text("\(failCount) failed")
                    .font(.caption)
                    .foregroundColor(.red)
            }

            // Pass/fail bar
            GeometryReader { geo in
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.green)
                        .frame(width: geo.size.width * CGFloat(passPercent / 100))
                    Rectangle()
                        .fill(Color.red)
                        .frame(width: geo.size.width * CGFloat(failPercent / 100))
                }
                .cornerRadius(4)
            }
            .frame(height: 6)
            .accessibilityLabel("\(passCount) passed, \(failCount) failed")

            // Filter buttons
            HStack(spacing: 4) {
                Button("All (\(testCases.count))") {
                    activeFilter = nil
                }
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(activeFilter == nil ? Color.accentColor.opacity(0.15) : Color.clear)
                .cornerRadius(8)

                Button("Pass (\(passCount))") {
                    activeFilter = activeFilter == "pass" ? nil : "pass"
                }
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(activeFilter == "pass" ? Color.green.opacity(0.15) : Color.clear)
                .cornerRadius(8)

                Button("Fail (\(failCount))") {
                    activeFilter = activeFilter == "fail" ? nil : "fail"
                }
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(activeFilter == "fail" ? Color.red.opacity(0.15) : Color.clear)
                .cornerRadius(8)
            }

            // Table header
            HStack {
                Button("Status\(sortIndicator("status"))") { handleSort("status") }
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("Input\(sortIndicator("input"))") { handleSort("input") }
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("Output\(sortIndicator("actual"))") { handleSort("actual") }
                    .frame(maxWidth: .infinity, alignment: .leading)
                if showExpected {
                    Button("Expected\(sortIndicator("expected"))") { handleSort("expected") }
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Button("Score\(sortIndicator("score"))") { handleSort("score") }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)

            Divider()

            // Rows
            if sortedCases.isEmpty {
                Text("No test cases match the current filter")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(sortedCases.enumerated()), id: \.element.id) { index, tc in
                        HStack {
                            Text(tc.pass ? "\u{2713} Pass" : "\u{2717} Fail")
                                .font(.caption)
                                .foregroundColor(tc.pass ? .green : .red)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text(truncate(tc.input, maxLength: 40))
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text(truncate(tc.actual, maxLength: 40))
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            if showExpected {
                                Text(truncate(tc.expected, maxLength: 40))
                                    .font(.caption)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(format: "%.0f", tc.score))
                                    .font(.caption)
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(Color.gray.opacity(0.2))
                                            .frame(height: 4)
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(tc.pass ? Color.green : Color.red)
                                            .frame(width: geo.size.width * CGFloat(min(100, tc.score) / 100), height: 4)
                                    }
                                }
                                .frame(height: 4)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityLabel("Score: \(Int(tc.score))")
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(selectedId == tc.id ? Color.accentColor.opacity(0.1) : Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if selectedId == tc.id {
                                selectedId = nil
                                widgetState = evalResultsTableReduce(state: widgetState, event: .deselect)
                            } else {
                                selectedId = tc.id
                                widgetState = evalResultsTableReduce(state: widgetState, event: .selectRow)
                                onSelect?(tc)
                            }
                        }
                    }
                }
            }

            // Detail panel
            if widgetState == .rowSelected, let tc = selectedCase {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(tc.pass ? "\u{2713} Passed" : "\u{2717} Failed")
                            .foregroundColor(tc.pass ? .green : .red)
                            .fontWeight(.semibold)
                        Text("Score: \(Int(tc.score))")
                            .foregroundColor(.secondary)
                        Spacer()
                        Button {
                            selectedId = nil
                            widgetState = evalResultsTableReduce(state: widgetState, event: .deselect)
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundColor(.secondary)
                        }
                        .accessibilityLabel("Close detail panel")
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Input").font(.caption).fontWeight(.semibold)
                        Text(tc.input)
                            .font(.system(.caption, design: .monospaced))
                            .padding(4)
                            .background(Color.gray.opacity(0.05))
                            .cornerRadius(4)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Model Output").font(.caption).fontWeight(.semibold)
                        Text(tc.actual)
                            .font(.system(.caption, design: .monospaced))
                            .padding(4)
                            .background(Color.gray.opacity(0.05))
                            .cornerRadius(4)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Expected Output").font(.caption).fontWeight(.semibold)
                        Text(tc.expected)
                            .font(.system(.caption, design: .monospaced))
                            .padding(4)
                            .background(Color.gray.opacity(0.05))
                            .cornerRadius(4)
                    }

                    if tc.actual != tc.expected {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Diff").font(.caption).fontWeight(.semibold)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("- \(tc.expected)")
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(.red)
                                Text("+ \(tc.actual)")
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(.green)
                            }
                            .padding(4)
                            .background(Color.gray.opacity(0.05))
                            .cornerRadius(4)
                        }
                    }

                    if let metrics = tc.metrics, !metrics.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Metrics").font(.caption).fontWeight(.semibold)
                            ForEach(Array(metrics.keys.sorted()), id: \.self) { metric in
                                let value = metrics[metric] ?? 0
                                HStack {
                                    Text(metric)
                                        .font(.caption)
                                    Spacer()
                                    Text(String(format: "%.0f", value))
                                        .font(.caption)
                                    GeometryReader { geo in
                                        ZStack(alignment: .leading) {
                                            RoundedRectangle(cornerRadius: 2)
                                                .fill(Color.gray.opacity(0.2))
                                                .frame(height: 4)
                                            RoundedRectangle(cornerRadius: 2)
                                                .fill(Color.blue)
                                                .frame(width: geo.size.width * CGFloat(min(100, value) / 100), height: 4)
                                        }
                                    }
                                    .frame(width: 60, height: 4)
                                }
                            }
                        }
                    }
                }
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Evaluation results")
        .onAppear {
            sortByCol = sortBy
            sortOrd = sortOrder
            activeFilter = filterStatus
        }
    }
}
