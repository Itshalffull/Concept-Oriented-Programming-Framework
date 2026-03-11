#!/usr/bin/env python3
"""Generate all 47 SwiftUI concept widgets from templates."""
import os

BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "surface", "widgets", "swiftui", "components", "widgets", "concepts"
)

def write_widget(suite, name, content):
    path = os.path.join(BASE, suite, name + ".swift")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {suite}/{name}.swift")

# ============================================================
# formal-verification
# ============================================================

write_widget("formal-verification", "FormulaDisplay", r"""import SwiftUI

enum FormulaLanguage: String, CaseIterable {
    case smtlib, tlaplus, alloy, lean, dafny, cvl
    var displayName: String {
        switch self {
        case .smtlib: return "SMT-LIB"
        case .tlaplus: return "TLA+"
        case .alloy: return "Alloy"
        case .lean: return "Lean"
        case .dafny: return "Dafny"
        case .cvl: return "CVL"
        }
    }
}

enum FormulaDisplayWidgetState { case idle, copied, rendering }

struct FormulaDisplayView: View {
    let formula: String
    var language: FormulaLanguage = .smtlib
    var scope: String?
    var renderLatex: Bool = false
    var name: String?
    var formulaDescription: String?

    @State private var widgetState: FormulaDisplayWidgetState = .idle
    @State private var expanded: Bool = false
    @State private var descriptionOpen: Bool = false

    private let collapseThreshold = 200
    private var isLong: Bool { formula.count > collapseThreshold }
    private var displayFormula: String {
        isLong && !expanded ? String(formula.prefix(collapseThreshold)) + "\u{2026}" : formula
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(language.displayName)
                    .font(.system(size: 12, design: .monospaced))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.primary.opacity(0.5), lineWidth: 1))
                if let scope = scope { Text(scope).font(.caption).opacity(0.7) }
                Spacer()
                Button(widgetState == .copied ? "Copied!" : "Copy") {
                    widgetState = .copied
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { widgetState = .idle }
                }
                .buttonStyle(.bordered).controlSize(.small)
                .accessibilityLabel("Copy formula to clipboard")
            }
            if let name = name { Text(name).fontWeight(.semibold) }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(displayFormula).font(.system(size: 13, design: .monospaced)).textSelection(.enabled).padding(8)
            }
            .background(Color.gray.opacity(0.08)).cornerRadius(4)
            if isLong {
                Button(expanded ? "Show less" : "Show more") { expanded.toggle() }
                    .font(.caption).buttonStyle(.plain)
            }
            if let desc = formulaDescription {
                Button(descriptionOpen ? "Hide description" : "Show description") { descriptionOpen.toggle() }
                    .font(.caption).buttonStyle(.plain)
                if descriptionOpen { Text(desc).font(.system(size: 14)).opacity(0.85) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Formula in \(language.displayName)")
    }
}
""")

write_widget("formal-verification", "ProofSessionTree", r"""import SwiftUI

enum ProofGoalStatus: String { case open, proved, failed, skipped }

struct ProofGoal: Identifiable {
    let id: String
    let label: String
    let status: ProofGoalStatus
    var tactic: String?
    var children: [ProofGoal]?
    var progress: Double?
    var statusIcon: String {
        switch status {
        case .proved: return "\u{2713}"
        case .failed: return "\u{2717}"
        case .open: return "\u{25CB}"
        case .skipped: return "\u{2298}"
        }
    }
}

enum ProofSessionTreeWidgetState { case idle, selected }

struct ProofSessionTreeView: View {
    let goals: [ProofGoal]
    var selectedId: String?
    var onSelectGoal: ((String?) -> Void)?

    @State private var internalSelectedId: String?
    @State private var expandedIds: Set<String> = []

    private var effectiveSelectedId: String? { selectedId ?? internalSelectedId }

    private func countGoals(_ gs: [ProofGoal]) -> (Int, Int) {
        var t = 0, p = 0
        for g in gs { t += 1; if g.status == .proved { p += 1 }; if let c = g.children { let r = countGoals(c); t += r.0; p += r.1 } }
        return (t, p)
    }

    private func findGoal(_ gs: [ProofGoal], _ id: String) -> ProofGoal? {
        for g in gs { if g.id == id { return g }; if let f = g.children.flatMap({ findGoal($0, id) }) { return f } }
        return nil
    }

    var body: some View {
        let (total, proved) = countGoals(goals)
        VStack(alignment: .leading, spacing: 4) {
            Text("\(proved) of \(total) goals proved").font(.subheadline).foregroundColor(.secondary)
            ForEach(goals) { g in goalRow(g, depth: 0) }
            if let sid = effectiveSelectedId, let sel = findGoal(goals, sid) {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text("\(sel.statusIcon) \(sel.status.rawValue.capitalized)"); Spacer()
                        Button("\u{2715}") { internalSelectedId = nil; onSelectGoal?(nil) }.buttonStyle(.plain)
                    }
                    Text("Goal: \(sel.label)").font(.subheadline)
                    if let t = sel.tactic { Text("Tactic: \(t)").font(.caption) }
                    if let p = sel.progress { Text("Progress: \(Int(p * 100))%").font(.caption) }
                }.padding(8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Proof session tree")
    }

    @ViewBuilder
    private func goalRow(_ goal: ProofGoal, depth: Int) -> some View {
        let hasChildren = goal.children?.isEmpty == false
        let isExpanded = expandedIds.contains(goal.id)
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if hasChildren {
                    Button(isExpanded ? "\u{25BC}" : "\u{25B6}") {
                        if expandedIds.contains(goal.id) { expandedIds.remove(goal.id) } else { expandedIds.insert(goal.id) }
                    }.buttonStyle(.plain).font(.caption)
                } else { Text(" ").frame(width: 16) }
                Text(goal.statusIcon)
                Text(goal.label)
                Spacer()
            }
            .padding(.leading, CGFloat(depth * 20)).padding(.vertical, 2)
            .background(effectiveSelectedId == goal.id ? Color.accentColor.opacity(0.15) : Color.clear)
            .cornerRadius(4)
            .contentShape(Rectangle())
            .onTapGesture { let next = effectiveSelectedId == goal.id ? nil : goal.id; internalSelectedId = next; onSelectGoal?(next) }
            .accessibilityLabel("\(goal.label), \(goal.status.rawValue)")
            if hasChildren && isExpanded { ForEach(goal.children ?? []) { c in goalRow(c, depth: depth + 1) } }
        }
    }
}
""")

write_widget("formal-verification", "StatusGrid", r"""import SwiftUI

enum CellStatus: String, CaseIterable {
    case passed, failed, running, pending, timeout
    var color: Color {
        switch self {
        case .passed: return .green; case .failed: return .red; case .running: return .blue
        case .pending: return .gray; case .timeout: return .orange
        }
    }
}

struct StatusGridItem: Identifiable {
    let id: String; let name: String; let status: CellStatus; var duration: Int?
}

struct StatusGridView: View {
    let items: [StatusGridItem]
    var columns: Int = 4
    var showAggregates: Bool = true
    var variant: String = "expanded"
    var onCellSelect: ((StatusGridItem) -> Void)?

    @State private var filter: String = "all"
    @State private var selectedIndex: Int?

    private var isCompact: Bool { variant == "compact" }
    private var filteredItems: [StatusGridItem] {
        if filter == "all" { return items }
        return items.filter { $0.status.rawValue == filter }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showAggregates {
                let counts = Dictionary(grouping: items, by: \.status).mapValues(\.count)
                Text(CellStatus.allCases.compactMap { s in counts[s].map { "\($0) \(s.rawValue)" } }.joined(separator: ", "))
                    .font(isCompact ? .caption : .subheadline)
            }
            HStack(spacing: 4) {
                ForEach(["all", "passed", "failed"], id: \.self) { v in
                    Button(v.capitalized) { filter = v; selectedIndex = nil }
                        .buttonStyle(.bordered).controlSize(.small)
                        .tint(filter == v ? .indigo : .gray)
                }
            }
            let cols = Array(repeating: GridItem(.flexible(), spacing: isCompact ? 2 : 4), count: min(columns, max(1, filteredItems.count)))
            LazyVGrid(columns: cols, spacing: isCompact ? 2 : 4) {
                ForEach(Array(filteredItems.enumerated()), id: \.element.id) { idx, item in
                    VStack(spacing: isCompact ? 2 : 4) {
                        Circle().fill(item.status.color).frame(width: isCompact ? 10 : 14, height: isCompact ? 10 : 14)
                        Text(item.name).font(.system(size: isCompact ? 10 : 12)).lineLimit(1)
                        if !isCompact, let d = item.duration { Text(d < 1000 ? "\(d)ms" : String(format: "%.1fs", Double(d)/1000)).font(.system(size: 11)).foregroundColor(.secondary) }
                    }
                    .padding(isCompact ? 4 : 8)
                    .background(selectedIndex == idx ? Color.accentColor.opacity(0.1) : Color.clear)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(selectedIndex == idx ? Color.indigo : Color.clear, lineWidth: 2))
                    .cornerRadius(4).contentShape(Rectangle())
                    .onTapGesture { selectedIndex = idx; onCellSelect?(item) }
                    .accessibilityLabel("\(item.name): \(item.status.rawValue)")
                }
            }
            if let idx = selectedIndex, idx < filteredItems.count {
                let item = filteredItems[idx]
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).fontWeight(.semibold)
                    HStack { Circle().fill(item.status.color).frame(width: 10, height: 10); Text("Status: \(item.status.rawValue.capitalized)") }
                    if let d = item.duration { Text("Duration: \(d < 1000 ? "\(d)ms" : String(format: "%.1fs", Double(d)/1000))").foregroundColor(.secondary) }
                }.font(.system(size: 13)).padding(12).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Verification status matrix")
    }
}
""")

write_widget("formal-verification", "TraceStepControls", r"""import SwiftUI

enum TraceStepControlsWidgetState { case paused, playing }

struct TraceStepControlsView: View {
    let currentStep: Int
    let totalSteps: Int
    let playing: Bool
    var speed: Int = 1
    var showSpeed: Bool = true
    var onStepForward: (() -> Void)?
    var onStepBack: (() -> Void)?
    var onPlay: (() -> Void)?
    var onPause: (() -> Void)?
    var onSeek: ((Int) -> Void)?
    var onFirst: (() -> Void)?
    var onLast: (() -> Void)?
    var onSpeedChange: ((Int) -> Void)?

    @State private var widgetState: TraceStepControlsWidgetState = .paused

    private var atFirst: Bool { currentStep <= 0 }
    private var atLast: Bool { currentStep >= totalSteps - 1 }
    private var progressPercent: Double { totalSteps > 0 ? Double(currentStep + 1) / Double(totalSteps) : 0 }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                Button("\u{25C4}\u{2502}") { onFirst?() }.disabled(atFirst).accessibilityLabel("Jump to start")
                Button("\u{25C4}") { onStepBack?() }.disabled(atFirst).accessibilityLabel("Step backward")
                Button(playing ? "\u{23F8}" : "\u{25B6}") {
                    if playing { onPause?(); widgetState = .paused } else { onPlay?(); widgetState = .playing }
                }.accessibilityLabel(playing ? "Pause" : "Play")
                Button("\u{25BA}") { onStepForward?() }.disabled(atLast).accessibilityLabel("Step forward")
                Button("\u{2502}\u{25BA}") { onLast?() }.disabled(atLast).accessibilityLabel("Jump to end")
            }
            .buttonStyle(.bordered)

            Text("Step \(currentStep + 1) of \(totalSteps)")
                .font(.subheadline)
                .accessibilityLabel("Step \(currentStep + 1) of \(totalSteps)")

            ProgressView(value: progressPercent)
                .accessibilityLabel("Trace progress")

            if showSpeed {
                HStack(spacing: 4) {
                    ForEach([1, 2, 4], id: \.self) { s in
                        Button("\(s)x") { onSpeedChange?(s) }
                            .buttonStyle(.bordered).controlSize(.small)
                            .tint(s == speed ? .accentColor : .gray)
                            .accessibilityLabel("Playback speed \(s)x")
                    }
                }
            }
        }
        .onChange(of: playing) { newVal in widgetState = newVal ? .playing : .paused }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace step controls")
    }
}
""")

write_widget("formal-verification", "TraceTimelineViewer", r"""import SwiftUI

struct TraceStep: Identifiable {
    let id: Int
    let index: Int
    let label: String
    let state: [String: String]
    var isError: Bool = false
    var timestamp: String?
}

enum TraceTimelineWidgetState { case idle, playing, cellSelected }

struct TraceTimelineViewerView: View {
    let steps: [TraceStep]
    var variables: [String]?
    var currentStep: Int?
    var playbackSpeed: Double = 1.0
    var showChangesOnly: Bool = false
    var onStepChange: ((Int) -> Void)?

    @State private var widgetState: TraceTimelineWidgetState = .idle
    @State private var internalStep: Int = 0
    @State private var selectedCell: (step: Int, variable: String)?

    private var activeStep: Int { currentStep ?? internalStep }
    private var derivedVariables: [String] {
        if let v = variables { return v }
        var keys = Set<String>()
        for s in steps { for k in s.state.keys { keys.insert(k) } }
        return Array(keys).sorted()
    }

    private func didChange(_ stepIdx: Int, _ variable: String) -> Bool {
        guard stepIdx > 0, stepIdx < steps.count else { return false }
        return steps[stepIdx - 1].state[variable] != steps[stepIdx].state[variable]
    }

    private func goToStep(_ idx: Int) {
        let clamped = max(0, min(idx, steps.count - 1))
        internalStep = clamped
        onStepChange?(clamped)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Step headers
            ScrollView(.horizontal) {
                HStack(spacing: 2) {
                    Text("Var").frame(width: 80, alignment: .leading).font(.caption.bold())
                    ForEach(steps) { step in
                        Text("\(step.index)").frame(width: 60).font(.caption)
                            .foregroundColor(step.isError ? .red : .primary)
                    }
                }
            }

            // Variable lanes
            ForEach(derivedVariables, id: \.self) { variable in
                ScrollView(.horizontal) {
                    HStack(spacing: 2) {
                        Text(variable).frame(width: 80, alignment: .leading).font(.caption).lineLimit(1)
                        ForEach(steps) { step in
                            let value = step.state[variable] ?? ""
                            let changed = didChange(step.index, variable)
                            let isCurrent = step.index == activeStep
                            let isSelected = selectedCell?.step == step.index && selectedCell?.variable == variable
                            Text(value).frame(width: 60).font(.system(size: 11, design: .monospaced))
                                .fontWeight(changed ? .bold : .regular)
                                .background(isSelected ? Color.accentColor.opacity(0.2) : isCurrent ? Color.yellow.opacity(0.1) : step.isError ? Color.red.opacity(0.1) : Color.clear)
                                .overlay(RoundedRectangle(cornerRadius: 2).stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 1))
                                .onTapGesture { selectedCell = (step.index, variable); goToStep(step.index); widgetState = .cellSelected }
                        }
                    }
                }
            }

            // Controls
            HStack {
                Button("\u{AB}") { goToStep(activeStep - 1) }.disabled(activeStep <= 0)
                Button(widgetState == .playing ? "\u{23F8}" : "\u{25B6}") {
                    widgetState = widgetState == .playing ? .idle : .playing
                }
                Button("\u{BB}") { goToStep(activeStep + 1) }.disabled(activeStep >= steps.count - 1)
                Text(steps.isEmpty ? "0 / 0" : "\(activeStep + 1) / \(steps.count)").font(.caption)
            }.buttonStyle(.bordered)

            // Detail panel
            if widgetState == .cellSelected, activeStep < steps.count {
                let step = steps[activeStep]
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Step \(step.index): \(step.label)").font(.subheadline.bold())
                        if step.isError { Text("(error)").foregroundColor(.red) }
                    }
                    if let ts = step.timestamp { Text(ts).font(.caption).foregroundColor(.secondary) }
                    ForEach(Array(step.state.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text(key).font(.caption).fontWeight(.medium)
                            Text(step.state[key] ?? "").font(.system(size: 12, design: .monospaced))
                                .fontWeight(didChange(activeStep, key) ? .bold : .regular)
                        }
                    }
                }.padding(8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace timeline")
    }
}
""")

write_widget("formal-verification", "VerificationStatusBadge", r"""import SwiftUI

enum VerificationStatus: String { case proved, refuted, unknown, timeout, running }

enum VerificationBadgeWidgetState { case idle, hovered, animating }

struct VerificationStatusBadgeView: View {
    var status: VerificationStatus = .unknown
    var label: String = "Unknown"
    var duration: Int?
    var solver: String?
    var size: String = "md"

    @State private var widgetState: VerificationBadgeWidgetState = .idle
    @State private var isHovered: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var statusIcon: String {
        switch status {
        case .proved: return "\u{2713}"
        case .refuted: return "\u{2717}"
        case .unknown: return "?"
        case .timeout: return "\u{23F0}"
        case .running: return "\u{25CB}"
        }
    }

    private var statusColor: Color {
        switch status {
        case .proved: return .green
        case .refuted: return .red
        case .unknown: return .gray
        case .timeout: return .orange
        case .running: return .blue
        }
    }

    private var fontSize: CGFloat {
        switch size { case "sm": return 12; case "lg": return 18; default: return 14 }
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(statusIcon).foregroundColor(statusColor)
            Text(label).font(.system(size: fontSize))
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(6)
        .onHover { hovering in isHovered = hovering; widgetState = hovering ? .hovered : .idle }
        .overlay(alignment: .top) {
            if isHovered, let tooltipText = tooltipContent {
                Text(tooltipText)
                    .font(.caption)
                    .padding(6)
                    .background(Color(.darkGray))
                    .foregroundColor(.white)
                    .cornerRadius(4)
                    .offset(y: -30)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verification status: \(label)")
        .accessibilityValue([solver, duration.map { "\($0)ms" }].compactMap { $0 }.joined(separator: ", "))
    }

    private var tooltipContent: String? {
        let parts = [solver, duration.map { "\($0)ms" }].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " \u{2014} ")
    }
}
""")

# ============================================================
# governance-decision
# ============================================================

write_widget("governance-decision", "DeliberationThread", r"""import SwiftUI

enum ArgumentTag: String, CaseIterable {
    case `for`, against, question, amendment
    var color: Color {
        switch self { case .for: return .green; case .against: return .red; case .question: return .blue; case .amendment: return .yellow }
    }
    var label: String { rawValue.capitalized }
}

struct DeliberationEntry: Identifiable {
    let id: String; let author: String; var avatar: String?; let content: String
    let timestamp: String; let tag: ArgumentTag; var parentId: String?; var relevance: Double?
}

enum DeliberationThreadWidgetState { case viewing, composing, entrySelected }

struct DeliberationThreadView: View {
    let entries: [DeliberationEntry]
    let status: String
    var summary: String?
    var showSentiment: Bool = true
    var showTags: Bool = true
    var maxNesting: Int = 3
    var onReply: ((String, String) -> Void)?
    var onEntrySelect: ((String) -> Void)?

    @State private var widgetState: DeliberationThreadWidgetState = .viewing
    @State private var selectedEntryId: String?
    @State private var replyTargetId: String?
    @State private var composeText: String = ""
    @State private var sortMode: String = "time"

    private var sortedEntries: [DeliberationEntry] {
        switch sortMode {
        case "tag": return entries.sorted { $0.tag.rawValue < $1.tag.rawValue }
        case "relevance": return entries.sorted { ($0.relevance ?? 0) > ($1.relevance ?? 0) }
        default: return entries.sorted { $0.timestamp < $1.timestamp }
        }
    }

    private var rootEntries: [DeliberationEntry] { sortedEntries.filter { $0.parentId == nil } }

    private func children(of id: String) -> [DeliberationEntry] {
        sortedEntries.filter { $0.parentId == id }
    }

    private var sentiment: (forCount: Int, againstCount: Int, ratio: Double) {
        let f = entries.filter { $0.tag == .for }.count
        let a = entries.filter { $0.tag == .against }.count
        let total = f + a
        return (f, a, total > 0 ? Double(f) / Double(total) : 0.5)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text(status).fontWeight(.semibold).textCase(.uppercase)
                Spacer()
                ForEach(["time", "tag", "relevance"], id: \.self) { mode in
                    Button(mode.capitalized) { sortMode = mode }
                        .buttonStyle(.bordered).controlSize(.mini)
                        .tint(sortMode == mode ? .accentColor : .gray)
                }
            }
            if let s = summary { Text(s).font(.subheadline).foregroundColor(.secondary) }

            // Sentiment bar
            if showSentiment {
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        Rectangle().fill(Color.green).frame(width: geo.size.width * sentiment.ratio)
                        Rectangle().fill(Color.red)
                    }
                }
                .frame(height: 8).cornerRadius(4)
                .accessibilityLabel("Sentiment: \(sentiment.forCount) for, \(sentiment.againstCount) against")
            }

            // Entries
            if rootEntries.isEmpty {
                Text("No contributions yet.").foregroundColor(.secondary).italic()
            } else {
                ForEach(rootEntries) { entry in entryRow(entry, depth: 0) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Deliberation thread")
    }

    @ViewBuilder
    private func entryRow(_ entry: DeliberationEntry, depth: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle().fill(Color.gray.opacity(0.3)).frame(width: 28, height: 28)
                    .overlay(Text(String(entry.author.prefix(1)).uppercased()).font(.system(size: 14, weight: .semibold)))
                Text(entry.author).fontWeight(.medium)
                if showTags {
                    Text(entry.tag.label).font(.caption).padding(.horizontal, 8).padding(.vertical, 2)
                        .background(entry.tag.color).foregroundColor(.white).cornerRadius(12)
                }
                Spacer()
                Text(entry.timestamp).font(.caption).foregroundColor(.secondary)
            }
            Text(entry.content).font(.body)
            HStack {
                Button("Reply") { replyTargetId = entry.id; widgetState = .composing }.buttonStyle(.plain).font(.caption)
            }

            // Compose box
            if widgetState == .composing && replyTargetId == entry.id {
                VStack(alignment: .leading, spacing: 4) {
                    TextEditor(text: $composeText)
                        .frame(height: 60).overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3)))
                    HStack {
                        Button("Send") { onReply?(entry.id, composeText); composeText = ""; widgetState = .viewing }
                        Button("Cancel") { composeText = ""; widgetState = .viewing }
                    }.buttonStyle(.bordered).controlSize(.small)
                }.padding(.leading, 24)
            }

            // Children
            let kids = children(of: entry.id)
            if !kids.isEmpty && depth < maxNesting {
                ForEach(kids) { child in entryRow(child, depth: depth + 1) }
            }
        }
        .padding(.leading, CGFloat(depth * 24))
        .padding(.vertical, 4)
        .accessibilityLabel("\(entry.author): \(entry.tag.label)")
    }
}
""")

write_widget("governance-decision", "ProposalCard", r"""import SwiftUI

enum ProposalCardWidgetState { case idle, hovered, focused, navigating }

struct ProposalCardView: View {
    let title: String
    let description: String
    let author: String
    let status: String
    let timestamp: String
    var variant: String = "full"
    var showVoteBar: Bool = true
    var showQuorum: Bool = false
    var truncateDescription: Int = 120
    var onClick: (() -> Void)?
    var onNavigate: (() -> Void)?

    @State private var widgetState: ProposalCardWidgetState = .idle
    @State private var isHovered: Bool = false

    private var truncatedDesc: String {
        description.count <= truncateDescription ? description : String(description.prefix(truncateDescription)) + "\u{2026}"
    }

    private var actionLabel: String {
        switch status {
        case "Active": return "Vote"
        case "Passed", "Approved": return "Execute"
        case "Draft": return "Edit"
        default: return "View"
        }
    }

    private var isMinimal: Bool { variant == "minimal" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(status).font(.caption).fontWeight(.semibold).padding(.horizontal, 8).padding(.vertical, 2)
                .background(Color.accentColor.opacity(0.15)).cornerRadius(4)
                .accessibilityLabel("Status: \(status)")
            Text(title).font(.headline)
            if !isMinimal { Text(truncatedDesc).font(.subheadline).foregroundColor(.secondary) }
            if !isMinimal {
                HStack { Circle().fill(Color.gray.opacity(0.3)).frame(width: 24, height: 24); Text(author).font(.caption) }
                    .accessibilityLabel("Proposed by \(author)")
            }
            if showVoteBar && status == "Active" && !isMinimal {
                RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.1)).frame(height: 24)
            }
            Text(timestamp).font(.caption).foregroundColor(.secondary)
            if !isMinimal {
                Button(actionLabel) { onClick?(); onNavigate?() }
                    .buttonStyle(.bordered).accessibilityLabel("View proposal: \(title)")
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.2)))
        .contentShape(Rectangle())
        .onTapGesture { onClick?(); onNavigate?() }
        .onHover { isHovered = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(status) proposal: \(title)")
    }
}
""")

write_widget("governance-decision", "VoteResultBar", r"""import SwiftUI

struct VoteSegment: Identifiable {
    let id = UUID()
    let label: String; let count: Int; var color: Color?
}

enum VoteResultBarWidgetState { case idle, animating, segmentHovered }

struct VoteResultBarView: View {
    let segments: [VoteSegment]
    var total: Int?
    var variant: String = "binary"
    var showLabels: Bool = true
    var showQuorum: Bool = false
    var quorumThreshold: Double = 0
    var animate: Bool = true
    var size: String = "md"
    var onSegmentHover: ((Int?, VoteSegment?) -> Void)?

    @State private var widgetState: VoteResultBarWidgetState = .idle
    @State private var hoveredIndex: Int?

    private let defaultColors: [Color] = [.green, .red, .orange, .blue, .purple, .cyan]
    private var effectiveTotal: Int { total ?? segments.reduce(0) { $0 + $1.count } }
    private var barHeight: CGFloat { size == "sm" ? 16 : size == "lg" ? 36 : 24 }

    private func percent(_ count: Int) -> Double {
        effectiveTotal > 0 ? Double(count) / Double(effectiveTotal) * 100 : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    HStack(spacing: 0) {
                        ForEach(Array(segments.enumerated()), id: \.element.id) { idx, seg in
                            let w = geo.size.width * CGFloat(percent(seg.count) / 100)
                            Rectangle()
                                .fill(seg.color ?? defaultColors[idx % defaultColors.count])
                                .frame(width: max(w, seg.count == 0 ? 2 : w))
                                .opacity(hoveredIndex != nil && hoveredIndex != idx ? 0.5 : 1)
                                .onHover { h in hoveredIndex = h ? idx : nil; onSegmentHover?(h ? idx : nil, h ? seg : nil) }
                        }
                    }
                    if showQuorum && quorumThreshold > 0 {
                        Rectangle().fill(Color.black).frame(width: 2)
                            .offset(x: geo.size.width * CGFloat(quorumThreshold / 100))
                    }
                }
            }
            .frame(height: barHeight)
            .cornerRadius(4)

            if showLabels {
                HStack(spacing: 12) {
                    ForEach(Array(segments.enumerated()), id: \.element.id) { idx, seg in
                        HStack(spacing: 4) {
                            Circle().fill(seg.color ?? defaultColors[idx % defaultColors.count]).frame(width: 8, height: 8)
                            Text("\(seg.label) \(seg.count) (\(String(format: "%.1f", percent(seg.count)))%)")
                                .font(.system(size: size == "sm" ? 11 : size == "lg" ? 14 : 12))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            Text("Total: \(effectiveTotal)").font(.system(size: size == "sm" ? 11 : 12)).foregroundColor(.secondary)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Vote results, total \(effectiveTotal) votes")
    }
}
""")

# ============================================================
# governance-execution
# ============================================================

write_widget("governance-execution", "ExecutionPipeline", r"""import SwiftUI

enum PipelineStageStatus: String { case pending, active, complete, failed, skipped }

struct PipelineStage: Identifiable {
    let id: String; let name: String; let status: PipelineStageStatus
    var description: String?; var isTimelock: Bool = false
    var statusIcon: String {
        switch status {
        case .complete: return "\u{2713}"; case .failed: return "\u{2717}"
        case .skipped: return "\u{25B7}"; default: return "\u{25CF}"
        }
    }
}

enum ExecutionPipelineWidgetState { case idle, stageSelected, failed }

struct ExecutionPipelineView: View {
    let stages: [PipelineStage]
    let currentStage: String
    let status: String
    var showTimer: Bool = true
    var showActions: Bool = true
    var compact: Bool = false
    var onStageSelect: ((String) -> Void)?
    var onRetry: (() -> Void)?
    var onCancel: (() -> Void)?
    var onForceExecute: (() -> Void)?

    @State private var widgetState: ExecutionPipelineWidgetState = .idle
    @State private var selectedIndex: Int = -1

    private var isFailed: Bool { status == "failed" || widgetState == .failed }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Pipeline stages
            ScrollView(.horizontal) {
                HStack(spacing: 4) {
                    ForEach(Array(stages.enumerated()), id: \.element.id) { idx, stage in
                        let isCurrent = stage.id == currentStage
                        let isSelected = widgetState == .stageSelected && selectedIndex == idx
                        VStack(spacing: 2) {
                            Text(stage.statusIcon).font(.title3)
                                .foregroundColor(stage.status == .active ? .blue : stage.status == .failed ? .red : stage.status == .complete ? .green : .gray)
                            Text(stage.name).font(.caption).lineLimit(1)
                            if !compact, let desc = stage.description { Text(desc).font(.caption2).foregroundColor(.secondary) }
                        }
                        .padding(8)
                        .background(isSelected ? Color.accentColor.opacity(0.1) : isCurrent ? Color.blue.opacity(0.05) : Color.clear)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(isCurrent ? Color.blue.opacity(0.3) : Color.clear))
                        .contentShape(Rectangle())
                        .onTapGesture { selectedIndex = idx; widgetState = .stageSelected; onStageSelect?(stage.id) }
                        .accessibilityLabel("\(stage.name), \(stage.status.rawValue)")

                        if idx < stages.count - 1 { Image(systemName: "arrow.right").font(.caption).foregroundColor(.secondary) }
                    }
                }
            }

            // Detail panel
            if widgetState == .stageSelected && selectedIndex >= 0 && selectedIndex < stages.count {
                let stage = stages[selectedIndex]
                VStack(alignment: .leading, spacing: 4) {
                    Text(stage.name).fontWeight(.bold)
                    if let desc = stage.description { Text(desc).font(.subheadline) }
                    Text(stage.status.rawValue.capitalized).font(.caption).foregroundColor(.secondary)
                }.padding(8).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
            }

            // Failure banner
            if isFailed {
                HStack {
                    Text("Pipeline execution failed").foregroundColor(.red)
                    if let retry = onRetry { Button("Retry") { widgetState = .idle; retry() }.buttonStyle(.bordered) }
                }
            }

            // Action bar
            if showActions {
                HStack {
                    if let cancel = onCancel { Button("Cancel", action: cancel).buttonStyle(.bordered) }
                    if let force = onForceExecute { Button("Force Execute", action: force).buttonStyle(.bordered) }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution pipeline: \(status)")
    }
}
""")

write_widget("governance-execution", "GuardStatusPanel", r"""import SwiftUI

enum GuardStatus: String { case passing, failing, pending, bypassed }

struct Guard: Identifiable {
    var id: String { guardId ?? name }
    var guardId: String?; let name: String; let description: String; let status: GuardStatus; var lastChecked: String?
    var statusIcon: String {
        switch status { case .passing: return "\u{2713}"; case .failing: return "\u{2717}"; case .pending: return "\u{23F3}"; case .bypassed: return "\u{2298}" }
    }
}

enum GuardStatusPanelWidgetState { case idle, guardSelected }

struct GuardStatusPanelView: View {
    let guards: [Guard]
    let executionStatus: String
    var showConditions: Bool = true
    var onGuardSelect: ((Guard) -> Void)?

    @State private var widgetState: GuardStatusPanelWidgetState = .idle
    @State private var selectedGuardId: String?

    private var passingCount: Int { guards.filter { $0.status == .passing }.count }
    private var hasBlockingGuards: Bool { guards.contains { $0.status == .failing } }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Pre-execution Guards").font(.headline)
                Spacer()
                Text("\(passingCount) of \(guards.count) guards passing").font(.subheadline).foregroundColor(.secondary)
            }

            if hasBlockingGuards {
                Text("Execution is blocked by failing guards")
                    .foregroundColor(.red).font(.subheadline).padding(8)
                    .background(Color.red.opacity(0.1)).cornerRadius(6)
            }

            ForEach(guards) { guard_ in
                let isSelected = widgetState == .guardSelected && selectedGuardId == guard_.id
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(guard_.statusIcon)
                        Text(guard_.name).fontWeight(.medium)
                        Spacer()
                        Text(guard_.status.rawValue.capitalized).font(.caption)
                            .foregroundColor(guard_.status == .passing ? .green : guard_.status == .failing ? .red : .secondary)
                    }
                    if showConditions { Text(guard_.description).font(.caption).foregroundColor(.secondary) }
                    if isSelected {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(guard_.description).font(.caption)
                            if let lc = guard_.lastChecked { Text("Last checked: \(lc)").font(.caption2).foregroundColor(.secondary) }
                        }.padding(6).background(Color.gray.opacity(0.05)).cornerRadius(4)
                    }
                }
                .padding(8)
                .background(isSelected ? Color.accentColor.opacity(0.08) : Color.clear)
                .cornerRadius(6)
                .contentShape(Rectangle())
                .onTapGesture {
                    if isSelected { selectedGuardId = nil; widgetState = .idle }
                    else { selectedGuardId = guard_.id; widgetState = .guardSelected; onGuardSelect?(guard_) }
                }
                .accessibilityLabel("\(guard_.name), \(guard_.status.rawValue)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pre-execution guards")
    }
}
""")

write_widget("governance-execution", "TimelockCountdown", r"""import SwiftUI

enum TimelockCountdownWidgetState: String {
    case running, warning, critical, expired, executing, completed, paused
}

struct TimelockCountdownView: View {
    let phase: String
    let deadline: String
    let elapsed: Double
    let total: Double
    var showChallenge: Bool = true
    var warningThreshold: Double = 0.8
    var criticalThreshold: Double = 0.95
    var variant: String = "phase-based"
    var onExecute: (() -> Void)?
    var onChallenge: (() -> Void)?

    @State private var widgetState: TimelockCountdownWidgetState = .running
    @State private var remainingSeconds: Int = 0
    @State private var timer: Timer?

    private var progress: Double { total > 0 ? min(1, max(0, elapsed / total)) : 0 }
    private var progressPercent: Int { Int(progress * 100) }

    private var displayPhase: String {
        switch widgetState {
        case .expired: return "Ready to execute"
        case .executing: return "Executing..."
        case .completed: return "Execution complete"
        case .paused: return "\(phase) (paused)"
        default: return phase
        }
    }

    private var countdownText: String {
        if remainingSeconds <= 0 { return "0s" }
        let d = remainingSeconds / 86400, h = (remainingSeconds % 86400) / 3600
        let m = (remainingSeconds % 3600) / 60, s = remainingSeconds % 60
        var parts: [String] = []
        if d > 0 { parts.append("\(d)d") }; if h > 0 { parts.append("\(h)h") }
        if m > 0 { parts.append("\(m)m") }; parts.append("\(s)s")
        return parts.joined(separator: " ")
    }

    private var urgencyColor: Color {
        switch widgetState {
        case .critical: return .red; case .warning: return .orange
        case .expired: return .purple; default: return .primary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(displayPhase).font(.subheadline).fontWeight(.medium)
            Text(widgetState == .completed ? "Done" : countdownText)
                .font(.title2.monospacedDigit()).foregroundColor(urgencyColor)
            ProgressView(value: progress).tint(urgencyColor)
                .accessibilityLabel("Timelock progress: \(progressPercent)%")

            HStack {
                Button(widgetState == .executing ? "Executing..." : "Execute") { widgetState = .executing; onExecute?() }
                    .buttonStyle(.borderedProminent).disabled(widgetState != .expired)
                if showChallenge {
                    Button("Challenge") { onChallenge?() }
                        .buttonStyle(.bordered)
                        .disabled(widgetState == .expired || widgetState == .completed || widgetState == .executing)
                }
            }
        }
        .task { startTimer() }
        .onDisappear { timer?.invalidate() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(displayPhase): \(countdownText)")
    }

    private func startTimer() {
        updateRemaining()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            updateRemaining()
            if remainingSeconds <= 0 { widgetState = .expired; timer?.invalidate() }
            else if progress >= criticalThreshold { widgetState = .critical }
            else if progress >= warningThreshold { widgetState = .warning }
        }
    }

    private func updateRemaining() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: deadline) ?? ISO8601DateFormatter().date(from: deadline) {
            remainingSeconds = max(0, Int(date.timeIntervalSinceNow))
        }
    }
}
""")

print("\nDone with governance suites")
