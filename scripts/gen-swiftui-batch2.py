#!/usr/bin/env python3
"""Generate SwiftUI widget implementations - Batch 2: governance-structure + llm-agent"""
import os

BASE = "surface/widgets/swiftui/components/widgets/concepts"

def write_widget(suite, name, content):
    path = os.path.join(BASE, suite, f"{name}.swift")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {suite}/{name}.swift")

# ============================================================
# governance-structure/CircleOrgChart
# ============================================================
write_widget("governance-structure", "CircleOrgChart", r"""import SwiftUI

// MARK: - Types

struct CircleMember: Identifiable {
    let id = UUID()
    let name: String
    let role: String
}

struct Circle: Identifiable {
    let id: String
    let name: String
    let purpose: String
    var parentId: String?
    var members: [CircleMember]
    var jurisdiction: String?
    var policies: [String]?
}

struct CircleTreeNode: Identifiable {
    var id: String { circle.id }
    let circle: Circle
    var children: [CircleTreeNode]
}

// MARK: - State Machine

enum CircleOrgChartState { case idle, circleSelected }
enum CircleOrgChartEvent {
    case selectCircle(id: String)
    case deselect
    case expand(id: String)
    case collapse(id: String)
}

func circleOrgChartReduce(state: CircleOrgChartState, event: CircleOrgChartEvent) -> CircleOrgChartState {
    switch state {
    case .idle:
        if case .selectCircle = event { return .circleSelected }
        return state
    case .circleSelected:
        switch event {
        case .deselect: return .idle
        case .selectCircle: return .circleSelected
        default: return state
        }
    }
}

func buildCircleTree(_ circles: [Circle]) -> [CircleTreeNode] {
    var byId: [String: CircleTreeNode] = [:]
    for c in circles { byId[c.id] = CircleTreeNode(circle: c, children: []) }
    var roots: [CircleTreeNode] = []
    for c in circles {
        if let pid = c.parentId, byId[pid] != nil {
            byId[pid]!.children.append(byId[c.id]!)
        } else {
            roots.append(byId[c.id]!)
        }
    }
    return roots
}

// MARK: - View

struct CircleOrgChartView: View {
    let circles: [Circle]
    var layout: String = "tree"
    var showPolicies: Bool = true
    var showJurisdiction: Bool = true
    var maxAvatars: Int = 5
    var onSelectCircle: ((String?) -> Void)?

    @State private var widgetState: CircleOrgChartState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []

    private var tree: [CircleTreeNode] { buildCircleTree(circles) }
    private var selectedCircle: Circle? { circles.first { $0.id == selectedId } }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(tree) { node in
                        circleNode(node, depth: 0)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Governance circles")

            if widgetState == .circleSelected, let circle = selectedCircle {
                Divider()
                detailPanel(circle).frame(width: 260)
            }
        }
    }

    @ViewBuilder
    private func circleNode(_ node: CircleTreeNode, depth: Int) -> some View {
        let isExpanded = expandedIds.contains(node.circle.id)
        let isSelected = selectedId == node.circle.id
        let hasChildren = !node.children.isEmpty

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                if hasChildren {
                    Button(action: { toggleExpand(node.circle.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
                Text(node.circle.name).fontWeight(.semibold)
                Text("\(node.circle.members.count) member\(node.circle.members.count != 1 ? "s" : "")")
                    .font(.caption).foregroundColor(.secondary)
                Spacer()
                if showJurisdiction, let j = node.circle.jurisdiction {
                    Text(j).font(.caption2).padding(.horizontal, 4).background(Color.gray.opacity(0.15)).cornerRadius(3)
                }
            }
            .padding(.leading, CGFloat(depth * 24))
            .padding(.vertical, 6).padding(.horizontal, 8)
            .background(isSelected ? Color.blue.opacity(0.12) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture { selectCircle(node.circle.id) }
            .accessibilityLabel("\(node.circle.name): \(node.circle.purpose)")

            if showPolicies, let policies = node.circle.policies, !policies.isEmpty {
                HStack(spacing: 4) {
                    ForEach(policies, id: \.self) { p in
                        Text(p).font(.caption2).padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Color.blue.opacity(0.1)).cornerRadius(3)
                    }
                }.padding(.leading, CGFloat(depth * 24 + 28)).padding(.bottom, 4)
            }

            HStack(spacing: -4) {
                ForEach(Array(node.circle.members.prefix(maxAvatars).enumerated()), id: \.offset) { _, m in
                    Text(String(m.name.prefix(1)).uppercased())
                        .font(.caption2).fontWeight(.bold).frame(width: 22, height: 22)
                        .background(Circle().fill(Color.gray.opacity(0.2)))
                        .accessibilityLabel("\(m.name), \(m.role)")
                }
                if node.circle.members.count > maxAvatars {
                    Text("+\(node.circle.members.count - maxAvatars)")
                        .font(.caption2).frame(width: 22, height: 22)
                        .background(Circle().fill(Color.gray.opacity(0.15)))
                }
            }.padding(.leading, CGFloat(depth * 24 + 28)).padding(.bottom, 4)

            if hasChildren && isExpanded {
                ForEach(node.children) { child in circleNode(child, depth: depth + 1) }
            }
        }
    }

    @ViewBuilder
    private func detailPanel(_ circle: Circle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(circle.name).font(.headline)
                Spacer()
                Button(action: { deselectCircle() }) { Text("\u{2715}") }.buttonStyle(.plain)
                    .accessibilityLabel("Close detail panel")
            }
            Group {
                Text("Purpose").font(.caption).foregroundColor(.secondary)
                Text(circle.purpose)
            }
            if let j = circle.jurisdiction {
                Text("Jurisdiction").font(.caption).foregroundColor(.secondary)
                Text(j)
            }
            if let p = circle.policies, !p.isEmpty {
                Text("Policies").font(.caption).foregroundColor(.secondary)
                Text(p.joined(separator: ", "))
            }
            Text("Members (\(circle.members.count))").font(.caption).foregroundColor(.secondary)
            ForEach(circle.members) { m in
                HStack { Text(m.name); Spacer(); Text(m.role).foregroundColor(.secondary) }.font(.system(size: 13))
            }
            Spacer()
        }.padding()
    }

    private func selectCircle(_ id: String) {
        if selectedId == id { deselectCircle(); return }
        selectedId = id
        widgetState = circleOrgChartReduce(state: widgetState, event: .selectCircle(id: id))
        onSelectCircle?(id)
    }

    private func deselectCircle() {
        selectedId = nil
        widgetState = circleOrgChartReduce(state: widgetState, event: .deselect)
        onSelectCircle?(nil)
    }

    private func toggleExpand(_ id: String) {
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
    }
}
""")

# ============================================================
# governance-structure/DelegationGraph
# ============================================================
write_widget("governance-structure", "DelegationGraph", r"""import SwiftUI

// MARK: - Types

struct DelegationNode: Identifiable {
    let id: String
    let label: String
    var weight: Double?
    var avatar: String?
}

struct DelegationEdge: Identifiable {
    var id: String { "\(from)->\(to)" }
    let from: String
    let to: String
    var weight: Double?
}

// MARK: - State Machine

enum DelegationGraphState { case browsing, searching, selected, delegating, undelegating }
enum DelegationGraphEvent {
    case search(query: String)
    case selectDelegate(id: String)
    case switchView
    case clearSearch
    case deselect
    case beginDelegate
    case beginUndelegate
    case delegateComplete
    case undelegateComplete
}

func delegationGraphReduce(state: DelegationGraphState, event: DelegationGraphEvent) -> DelegationGraphState {
    switch state {
    case .browsing:
        switch event {
        case .search: return .searching
        case .selectDelegate: return .selected
        case .switchView: return .browsing
        default: return state
        }
    case .searching:
        switch event {
        case .clearSearch: return .browsing
        case .selectDelegate: return .selected
        default: return state
        }
    case .selected:
        switch event {
        case .deselect: return .browsing
        case .beginDelegate: return .delegating
        case .beginUndelegate: return .undelegating
        default: return state
        }
    case .delegating:
        if case .delegateComplete = event { return .browsing }
        return state
    case .undelegating:
        if case .undelegateComplete = event { return .browsing }
        return state
    }
}

private func computeEffWeight(_ nodeId: String, nodes: [DelegationNode], edges: [DelegationEdge], visited: Set<String> = []) -> Double {
    if visited.contains(nodeId) { return 0 }
    var v = visited; v.insert(nodeId)
    let base = nodes.first { $0.id == nodeId }?.weight ?? 1
    let incoming = edges.filter { $0.to == nodeId }
    var delegated = 0.0
    for edge in incoming {
        delegated += computeEffWeight(edge.from, nodes: nodes, edges: edges, visited: v) * (edge.weight ?? 1)
    }
    return base + delegated
}

private func fmtW(_ w: Double) -> String {
    w == w.rounded() ? String(Int(w)) : String(format: "%.2f", w)
}

// MARK: - View

struct DelegationGraphView: View {
    let nodes: [DelegationNode]
    let edges: [DelegationEdge]
    var currentUserId: String?
    var sortBy: String = "power"
    var showCurrentDelegation: Bool = true
    var onDelegate: ((String, String) -> Void)?
    var onUndelegate: ((String, String) -> Void)?
    var onSelectNode: ((String) -> Void)?

    @State private var widgetState: DelegationGraphState = .browsing
    @State private var searchQuery: String = ""
    @State private var selectedNodeId: String? = nil

    private var nodeWeights: [String: Double] {
        var w: [String: Double] = [:]
        for n in nodes { w[n.id] = computeEffWeight(n.id, nodes: nodes, edges: edges) }
        return w
    }

    private var filteredNodes: [DelegationNode] {
        var result = nodes
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            result = result.filter { $0.label.lowercased().contains(q) }
        }
        return result.sorted { (nodeWeights[$0.id] ?? 0) > (nodeWeights[$1.id] ?? 0) }
    }

    private var currentDelegation: (id: String, label: String, weight: Double)? {
        guard let uid = currentUserId, let edge = edges.first(where: { $0.from == uid }),
              let target = nodes.first(where: { $0.id == edge.to }) else { return nil }
        return (target.id, target.label, edge.weight ?? 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("Search delegates\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .onChange(of: searchQuery) { val in
                    if !val.isEmpty && widgetState == .browsing {
                        widgetState = delegationGraphReduce(state: widgetState, event: .search(query: val))
                    } else if val.isEmpty && widgetState == .searching {
                        widgetState = delegationGraphReduce(state: widgetState, event: .clearSearch)
                    }
                }
                .accessibilityLabel("Search delegates by name")

            if showCurrentDelegation {
                HStack {
                    if let d = currentDelegation {
                        Text("Delegating to \(d.label) (weight: \(fmtW(d.weight)))").font(.caption)
                    } else {
                        Text("Not currently delegating").font(.caption).foregroundColor(.secondary)
                    }
                }.padding(.horizontal, 12).padding(.bottom, 8)
            }

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(filteredNodes) { node in
                        let ew = nodeWeights[node.id] ?? 0
                        let isSelected = selectedNodeId == node.id
                        let isDelegatedTo = currentUserId != nil && edges.contains { $0.from == currentUserId! && $0.to == node.id }

                        HStack(spacing: 8) {
                            Text(node.avatar ?? String(node.label.prefix(1)).uppercased())
                                .font(.caption).fontWeight(.bold).frame(width: 28, height: 28)
                                .background(Circle().fill(Color.gray.opacity(0.2)))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(node.label).fontWeight(.medium)
                                Text("Power: \(fmtW(ew))").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            if let uid = currentUserId, node.id != uid {
                                Button(isDelegatedTo ? "Undelegate" : "Delegate") {
                                    if isDelegatedTo {
                                        widgetState = delegationGraphReduce(state: widgetState, event: .beginUndelegate)
                                        onUndelegate?(uid, node.id)
                                        widgetState = delegationGraphReduce(state: widgetState, event: .undelegateComplete)
                                    } else {
                                        widgetState = delegationGraphReduce(state: widgetState, event: .beginDelegate)
                                        onDelegate?(uid, node.id)
                                        widgetState = delegationGraphReduce(state: widgetState, event: .delegateComplete)
                                    }
                                }.font(.caption)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedNodeId = node.id
                            widgetState = delegationGraphReduce(state: widgetState, event: .selectDelegate(id: node.id))
                            onSelectNode?(node.id)
                        }
                        .accessibilityLabel("\(node.label), voting power: \(fmtW(ew))")
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Delegation management")
    }
}
""")

# ============================================================
# governance-structure/WeightBreakdown
# ============================================================
write_widget("governance-structure", "WeightBreakdown", r"""import SwiftUI

// MARK: - Types

enum WeightSourceType: String, CaseIterable { case token, delegation, reputation, manual }

struct WeightSource: Identifiable {
    let id = UUID()
    let label: String
    let weight: Double
    let type: WeightSourceType
}

// MARK: - State Machine

enum WeightBreakdownState { case idle, segmentHovered }
enum WeightBreakdownEvent {
    case hoverSegment(source: String)
    case leave
}

func weightBreakdownReduce(state: WeightBreakdownState, event: WeightBreakdownEvent) -> WeightBreakdownState {
    switch state {
    case .idle:
        if case .hoverSegment = event { return .segmentHovered }
        return state
    case .segmentHovered:
        if case .leave = event { return .idle }
        return state
    }
}

private func srcColor(_ type: WeightSourceType) -> Color {
    switch type {
    case .token: return .blue
    case .delegation: return .purple
    case .reputation: return .green
    case .manual: return .orange
    }
}

private func fmtWt(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.2f", v)
}

// MARK: - View

struct WeightBreakdownView: View {
    let sources: [WeightSource]
    let totalWeight: Double
    let participant: String
    var variant: String = "bar"
    var showLegend: Bool = true
    var showTotal: Bool = true

    @State private var widgetState: WeightBreakdownState = .idle
    @State private var hoveredSource: String? = nil

    private var segments: [(source: WeightSource, percent: Double)] {
        sources.sorted { $0.weight > $1.weight }.map { s in
            (s, totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showTotal {
                Text(fmtWt(totalWeight)).font(.title2).fontWeight(.bold)
                    .accessibilityLabel("Total weight: \(fmtWt(totalWeight))")
            }

            GeometryReader { geo in
                HStack(spacing: 0) {
                    ForEach(segments, id: \.source.id) { seg in
                        Rectangle().fill(srcColor(seg.source.type))
                            .opacity(hoveredSource != nil && hoveredSource != seg.source.label ? 0.5 : 1)
                            .frame(width: geo.size.width * CGFloat(seg.percent / 100))
                            .onHover { h in
                                if h {
                                    hoveredSource = seg.source.label
                                    widgetState = weightBreakdownReduce(state: widgetState, event: .hoverSegment(source: seg.source.label))
                                } else {
                                    hoveredSource = nil
                                    widgetState = weightBreakdownReduce(state: widgetState, event: .leave)
                                }
                            }
                            .accessibilityLabel("\(seg.source.label): \(fmtWt(seg.source.weight)) (\(fmtWt(seg.percent))%)")
                    }
                }
            }.frame(height: 24).cornerRadius(4)

            if widgetState == .segmentHovered, let h = hoveredSource,
               let seg = segments.first(where: { $0.source.label == h }) {
                HStack(spacing: 8) {
                    Circle().fill(srcColor(seg.source.type)).frame(width: 10, height: 10)
                    Text(seg.source.label).fontWeight(.medium)
                    Text(fmtWt(seg.source.weight))
                    Text("(\(fmtWt(seg.percent))%)").foregroundColor(.secondary)
                }.font(.system(size: 12)).padding(6).background(Color(.darkGray)).foregroundColor(.white).cornerRadius(4)
            }

            if showLegend {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(segments, id: \.source.id) { seg in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2).fill(srcColor(seg.source.type)).frame(width: 12, height: 12)
                            Text(seg.source.label).font(.system(size: 12))
                            Text("\(fmtWt(seg.percent))%").font(.system(size: 12)).foregroundColor(.secondary)
                            Text("(\(fmtWt(seg.source.weight)))").font(.system(size: 12)).foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Weight breakdown for \(participant): \(fmtWt(totalWeight)) total")
    }
}
""")

# ============================================================
# llm-agent/AgentTimeline
# ============================================================
write_widget("llm-agent", "AgentTimeline", r"""import SwiftUI

// MARK: - Types

enum EntryType: String, CaseIterable { case thought, toolCall = "tool-call", toolResult = "tool-result", response, error }
enum EntryStatus: String { case running, complete, error }

struct TimelineEntry: Identifiable {
    let id: String
    let type: EntryType
    let label: String
    let timestamp: String
    var duration: Int?
    var detail: String?
    var status: EntryStatus?
}

// MARK: - State Machine

enum AgentTimelineState: String { case idle, entrySelected, interrupted, inactive, active }
enum AgentTimelineEvent {
    case newEntry
    case selectEntry(id: String)
    case interrupt
    case deselect
    case resume
    case streamStart
    case streamEnd
}

func agentTimelineReduce(state: AgentTimelineState, event: AgentTimelineEvent) -> AgentTimelineState {
    switch state {
    case .idle:
        switch event {
        case .newEntry: return .idle
        case .selectEntry: return .entrySelected
        case .interrupt: return .interrupted
        default: return state
        }
    case .entrySelected:
        switch event {
        case .deselect: return .idle
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .interrupted:
        if case .resume = event { return .idle }
        return state
    case .inactive:
        if case .streamStart = event { return .active }
        return state
    case .active:
        if case .streamEnd = event { return .inactive }
        return state
    }
}

// MARK: - Helpers

private let typeIcons: [EntryType: String] = [
    .thought: "\u{2022}\u{2022}\u{2022}",
    .toolCall: "\u{2699}",
    .toolResult: "\u{2611}",
    .response: "\u{25B6}",
    .error: "\u{2717}"
]

private let typeLabels: [EntryType: String] = [
    .thought: "Thought", .toolCall: "Tool Call", .toolResult: "Tool Result",
    .response: "Response", .error: "Error"
]

private func fmtDuration(_ ms: Int) -> String {
    ms < 1000 ? "\(ms)ms" : "\(String(format: "%.1f", Double(ms) / 1000))s"
}

// MARK: - View

struct AgentTimelineView: View {
    let entries: [TimelineEntry]
    let agentName: String
    let status: String
    var showDelegations: Bool = true
    var autoScroll: Bool = true
    var maxEntries: Int = 100
    var onInterrupt: (() -> Void)?

    @State private var widgetState: AgentTimelineState = .idle
    @State private var selectedEntryId: String? = nil
    @State private var expandedIds: Set<String> = []
    @State private var typeFilter: EntryType? = nil

    private var visibleEntries: [TimelineEntry] {
        let limited = Array(entries.suffix(maxEntries))
        if let f = typeFilter { return limited.filter { $0.type == f } }
        return limited
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(agentName).font(.headline)
                HStack(spacing: 4) {
                    Circle().fill(status == "running" ? Color.green : Color.gray).frame(width: 8, height: 8)
                    Text(status).font(.caption)
                }
                Spacer()
                if status == "running" {
                    Button("Interrupt") {
                        widgetState = agentTimelineReduce(state: widgetState, event: .interrupt)
                        onInterrupt?()
                    }.font(.caption)
                }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Filter bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    Button("All") { typeFilter = nil }
                        .font(.system(size: 12))
                        .fontWeight(typeFilter == nil ? .semibold : .regular)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(typeFilter == nil ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4)
                        .buttonStyle(.plain)

                    ForEach(EntryType.allCases, id: \.self) { t in
                        Button("\(typeIcons[t] ?? "") \(typeLabels[t] ?? "")") { typeFilter = typeFilter == t ? nil : t }
                            .font(.system(size: 12))
                            .fontWeight(typeFilter == t ? .semibold : .regular)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(typeFilter == t ? Color.blue.opacity(0.15) : Color.clear)
                            .cornerRadius(4)
                            .buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.vertical, 6)

            Divider()

            if widgetState == .interrupted {
                HStack {
                    Text("Agent execution interrupted").font(.caption).foregroundColor(.red)
                }.padding(.horizontal, 12).padding(.vertical, 6).background(Color.red.opacity(0.08))
            }

            // Timeline entries
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(visibleEntries) { entry in
                            let isExpanded = expandedIds.contains(entry.id)
                            let isSelected = selectedEntryId == entry.id
                            let isRunning = entry.status == .running

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text(typeIcons[entry.type] ?? "").font(.system(size: 14))
                                    Text(entry.label).fontWeight(.medium).lineLimit(1)
                                    if isRunning {
                                        Text("\u{25CB}").foregroundColor(.blue)
                                            .accessibilityLabel("Running")
                                    }
                                    if let d = entry.duration, entry.status != .running {
                                        Text(fmtDuration(d)).font(.caption).foregroundColor(.secondary)
                                    }
                                    Spacer()
                                    Text(entry.timestamp).font(.caption2).foregroundColor(.secondary)
                                }

                                if isExpanded, let detail = entry.detail {
                                    Text(detail).font(.system(size: 13)).padding(.leading, 24).padding(.top, 4)
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if expandedIds.contains(entry.id) { expandedIds.remove(entry.id) }
                                else { expandedIds.insert(entry.id) }
                                selectedEntryId = entry.id
                                widgetState = agentTimelineReduce(state: widgetState, event: .selectEntry(id: entry.id))
                            }
                            .accessibilityLabel("\(typeLabels[entry.type] ?? ""): \(entry.label)")
                            .id(entry.id)
                        }
                    }
                }
                .onChange(of: entries.count) { _ in
                    if autoScroll, let last = visibleEntries.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Agent timeline: \(agentName)")
    }
}
""")

# ============================================================
# llm-agent/HitlInterrupt
# ============================================================
write_widget("llm-agent", "HitlInterrupt", r"""import SwiftUI

// MARK: - State Machine

enum HitlInterruptState: String { case pending, editing, approving, rejecting, forking, resolved }
enum HitlInterruptEvent {
    case approve, reject, modify, fork, save, cancel, complete, error
}

func hitlInterruptReduce(state: HitlInterruptState, event: HitlInterruptEvent) -> HitlInterruptState {
    switch state {
    case .pending:
        switch event {
        case .approve: return .approving
        case .reject: return .rejecting
        case .modify: return .editing
        case .fork: return .forking
        default: return state
        }
    case .editing:
        switch event {
        case .save, .cancel: return .pending
        default: return state
        }
    case .approving:
        switch event {
        case .complete: return .resolved
        case .error: return .pending
        default: return state
        }
    case .rejecting:
        if case .complete = event { return .resolved }
        return state
    case .forking:
        if case .complete = event { return .resolved }
        return state
    case .resolved:
        return state
    }
}

// MARK: - Types

enum RiskLevel: String, CaseIterable { case low, medium, high, critical }

private let riskConfig: [RiskLevel: (label: String, icon: String)] = [
    .low: ("Low Risk", "\u{2713}"),
    .medium: ("Medium Risk", "\u{26A0}"),
    .high: ("High Risk", "\u{2622}"),
    .critical: ("Critical Risk", "\u{2716}")
]

// MARK: - View

struct HitlInterruptView: View {
    let action: String
    let reason: String
    let risk: RiskLevel
    var context: String?
    var onApprove: (() -> Void)?
    var onDeny: (() -> Void)?
    var onRequestInfo: (() -> Void)?
    var autoDenySeconds: Int?

    @State private var widgetState: HitlInterruptState = .pending
    @State private var contextExpanded: Bool = false
    @State private var countdown: Int = 0
    @State private var timer: Timer?

    private var isResolved: Bool { widgetState == .resolved }
    private var riskInfo: (label: String, icon: String) { riskConfig[risk] ?? ("Unknown", "?") }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("\(riskInfo.icon) \(riskInfo.label)")
                    .font(.system(size: 13, weight: .semibold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(riskBackground).cornerRadius(4)
                    .accessibilityLabel(riskInfo.label)

                Spacer()

                if let ads = autoDenySeconds, ads > 0, !isResolved {
                    Text("Auto-deny in \(countdown)s")
                        .font(.caption).foregroundColor(.secondary)
                }

                if isResolved {
                    Text("Resolved").font(.caption).foregroundColor(.green)
                }
            }

            // Action
            HStack(alignment: .top) {
                Text("Action:").fontWeight(.bold)
                Text(action)
            }.font(.system(size: 14))

            // Reason
            HStack(alignment: .top) {
                Text("Reason:").fontWeight(.bold)
                Text(reason)
            }.font(.system(size: 14))

            // Context
            if let ctx = context {
                Button(action: { contextExpanded.toggle() }) {
                    HStack(spacing: 4) {
                        Text(contextExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                        Text("Additional Context").font(.system(size: 13))
                    }
                }.buttonStyle(.plain)
                .accessibilityLabel(contextExpanded ? "Hide additional context" : "Show additional context")

                if contextExpanded {
                    Text(ctx).font(.system(size: 13)).padding(.leading, 16)
                }
            }

            // Action bar
            HStack(spacing: 12) {
                Button(widgetState == .approving ? "Approving\u{2026}" : "Approve") {
                    guard !isResolved else { return }
                    widgetState = hitlInterruptReduce(state: widgetState, event: .approve)
                    onApprove?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Approve")

                Button(widgetState == .rejecting ? "Denying\u{2026}" : "Deny") {
                    guard !isResolved else { return }
                    widgetState = hitlInterruptReduce(state: widgetState, event: .reject)
                    onDeny?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Deny")

                Button("Ask for more info") {
                    guard !isResolved else { return }
                    onRequestInfo?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Ask for more info")
            }
        }
        .padding()
        .onAppear {
            if let ads = autoDenySeconds, ads > 0 {
                countdown = ads
                startCountdown()
            }
        }
        .onDisappear { timer?.invalidate() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Agent requires approval")
    }

    private var riskBackground: Color {
        switch risk {
        case .low: return Color.green.opacity(0.15)
        case .medium: return Color.yellow.opacity(0.15)
        case .high: return Color.orange.opacity(0.15)
        case .critical: return Color.red.opacity(0.15)
        }
    }

    private func startCountdown() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            if countdown <= 1 {
                t.invalidate()
                countdown = 0
                if !isResolved {
                    widgetState = hitlInterruptReduce(state: widgetState, event: .reject)
                    onDeny?()
                }
            } else {
                countdown -= 1
            }
        }
    }
}
""")

# ============================================================
# llm-agent/MemoryInspector
# ============================================================
write_widget("llm-agent", "MemoryInspector", r"""import SwiftUI

// MARK: - Types

enum MemoryEntryType: String, CaseIterable { case fact, instruction, conversation, toolResult = "tool-result" }

struct MemoryEntry: Identifiable {
    let id: String
    let type: MemoryEntryType
    let content: String
    var source: String?
    var timestamp: String?
    var relevance: Double?
}

// MARK: - State Machine

enum MemoryInspectorState { case viewing, searching, entrySelected, deleting }
enum MemoryInspectorEvent {
    case switchTab, search, selectEntry(id: String), clear, deselect, delete, confirm, cancel
}

func memoryInspectorReduce(state: MemoryInspectorState, event: MemoryInspectorEvent) -> MemoryInspectorState {
    switch state {
    case .viewing:
        switch event {
        case .switchTab: return .viewing
        case .search: return .searching
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .searching:
        switch event {
        case .clear: return .viewing
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .entrySelected:
        switch event {
        case .deselect: return .viewing
        case .delete: return .deleting
        default: return state
        }
    case .deleting:
        switch event {
        case .confirm: return .viewing
        case .cancel: return .entrySelected
        default: return state
        }
    }
}

private let memTypeLabels: [MemoryEntryType: String] = [
    .fact: "Facts", .instruction: "Instructions", .conversation: "Conversation", .toolResult: "Tool Results"
]

// MARK: - View

struct MemoryInspectorView: View {
    let entries: [MemoryEntry]
    let totalTokens: Int
    let maxTokens: Int
    var activeTab: String = "working"
    var showContext: Bool = true
    var onDelete: ((String) -> Void)?
    var onTabChange: ((String) -> Void)?

    @State private var widgetState: MemoryInspectorState = .viewing
    @State private var searchQuery: String = ""
    @State private var selectedId: String? = nil

    private let tabs = ["working", "episodic", "semantic", "procedural"]

    private var filteredEntries: [MemoryEntry] {
        if searchQuery.trimmingCharacters(in: .whitespaces).isEmpty { return entries }
        let q = searchQuery.lowercased()
        return entries.filter { $0.content.lowercased().contains(q) || ($0.source?.lowercased().contains(q) ?? false) }
    }

    private var grouped: [(type: MemoryEntryType, items: [MemoryEntry])] {
        MemoryEntryType.allCases.compactMap { t in
            let items = filteredEntries.filter { $0.type == t }
            return items.isEmpty ? nil : (t, items)
        }
    }

    private var tokenPercent: Double {
        maxTokens > 0 ? min(Double(totalTokens) / Double(maxTokens) * 100, 100) : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(tabs, id: \.self) { tab in
                        Button(tab.capitalized) {
                            widgetState = memoryInspectorReduce(state: widgetState, event: .switchTab)
                            onTabChange?(tab)
                        }
                        .font(.system(size: 12))
                        .fontWeight(tab == activeTab ? .semibold : .regular)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(tab == activeTab ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4).buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Search
            TextField("Search memories\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.bottom, 8)
                .onChange(of: searchQuery) { val in
                    if !val.trimmingCharacters(in: .whitespaces).isEmpty {
                        if widgetState != .searching { widgetState = memoryInspectorReduce(state: widgetState, event: .search) }
                    } else {
                        if widgetState == .searching { widgetState = memoryInspectorReduce(state: widgetState, event: .clear) }
                    }
                }
                .accessibilityLabel("Search memories")

            // Token bar
            if showContext {
                VStack(spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3).fill(tokenPercent > 90 ? Color.red : Color.blue)
                                .frame(width: geo.size.width * CGFloat(tokenPercent / 100))
                        }
                    }.frame(height: 8)
                    Text("\(totalTokens.formatted()) / \(maxTokens.formatted()) tokens")
                        .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("Context window: \(totalTokens) of \(maxTokens) tokens used")
            }

            Divider()

            // Entry list
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(grouped, id: \.type) { group in
                        HStack {
                            Text(memTypeLabels[group.type] ?? "").font(.caption).foregroundColor(.secondary)
                            Spacer()
                            Text("\(group.items.count)").font(.caption2).foregroundColor(.secondary)
                        }.padding(.horizontal, 12).padding(.vertical, 4)

                        ForEach(group.items) { entry in
                            let isSelected = selectedId == entry.id
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.type.rawValue).font(.caption2).foregroundColor(.secondary)
                                Text(isSelected ? entry.content : String(entry.content.prefix(120)))
                                    .font(.system(size: 13)).lineLimit(isSelected ? nil : 2)
                                HStack {
                                    if let s = entry.source { Text(s).font(.caption2).foregroundColor(.secondary) }
                                    if let t = entry.timestamp { Text(t).font(.caption2).foregroundColor(.secondary) }
                                    if let r = entry.relevance { Text("\(Int(r * 100))%").font(.caption2).foregroundColor(.secondary) }
                                    Spacer()
                                    if isSelected && widgetState == .entrySelected {
                                        Button("Delete") {
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .delete)
                                        }.font(.caption).foregroundColor(.red)
                                    }
                                }
                                if isSelected && widgetState == .deleting {
                                    HStack {
                                        Text("Delete this entry?").font(.caption)
                                        Button("Confirm") {
                                            onDelete?(entry.id)
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .confirm)
                                            selectedId = nil
                                        }.font(.caption)
                                        Button("Cancel") {
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .cancel)
                                        }.font(.caption)
                                    }
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(isSelected ? Color.blue.opacity(0.08) : Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if isSelected {
                                    selectedId = nil
                                    widgetState = memoryInspectorReduce(state: widgetState, event: .deselect)
                                } else {
                                    selectedId = entry.id
                                    widgetState = memoryInspectorReduce(state: widgetState, event: .selectEntry(id: entry.id))
                                }
                            }
                            .accessibilityLabel("\(entry.type.rawValue): \(String(entry.content.prefix(60)))")
                        }
                    }

                    if filteredEntries.isEmpty {
                        Text(searchQuery.isEmpty ? "No memory entries." : "No matching entries found.")
                            .font(.caption).foregroundColor(.secondary)
                            .padding(12)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Memory inspector")
    }
}
""")

# ============================================================
# llm-agent/ReasoningBlock
# ============================================================
write_widget("llm-agent", "ReasoningBlock", r"""import SwiftUI

// MARK: - State Machine

enum ReasoningBlockState { case collapsed, expanded, streaming }
enum ReasoningBlockEvent { case expand, collapse, toggle, streamStart, token, streamEnd }

func reasoningBlockReduce(state: ReasoningBlockState, event: ReasoningBlockEvent) -> ReasoningBlockState {
    switch state {
    case .collapsed:
        switch event {
        case .expand, .toggle: return .expanded
        case .streamStart: return .streaming
        default: return state
        }
    case .expanded:
        switch event {
        case .collapse, .toggle: return .collapsed
        default: return state
        }
    case .streaming:
        switch event {
        case .token: return .streaming
        case .streamEnd: return .collapsed
        default: return state
        }
    }
}

// MARK: - View

struct ReasoningBlockView: View {
    let content: String
    var collapsed: Bool = true
    var onToggle: (() -> Void)?
    var defaultExpanded: Bool = false
    var showDuration: Bool = true
    var streaming: Bool = false
    var duration: Int?

    @State private var widgetState: ReasoningBlockState = .collapsed

    private var isBodyVisible: Bool { widgetState == .expanded || widgetState == .streaming }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button(action: handleToggle) {
                HStack(spacing: 8) {
                    Text("\u{1F9E0}").font(.system(size: 16))
                    Text(widgetState == .streaming ? "Thinking..." : "Reasoning")
                        .font(.system(size: 14, weight: .medium))
                    if showDuration && widgetState != .streaming, let d = duration {
                        Text("\(d)ms").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(isBodyVisible ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10)).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Toggle reasoning details")

            if isBodyVisible {
                Text(content)
                    .font(.system(size: 13))
                    .padding(.horizontal, 12).padding(.bottom, 12)
                    .accessibilityLabel("Reasoning content")
            }
        }
        .onAppear {
            widgetState = streaming ? .streaming : (defaultExpanded ? .expanded : .collapsed)
        }
        .onChange(of: streaming) { s in
            if s && widgetState != .streaming {
                widgetState = reasoningBlockReduce(state: widgetState, event: .streamStart)
            }
            if !s && widgetState == .streaming {
                widgetState = reasoningBlockReduce(state: widgetState, event: .streamEnd)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Model reasoning")
    }

    private func handleToggle() {
        guard widgetState != .streaming else { return }
        widgetState = reasoningBlockReduce(state: widgetState, event: .toggle)
        onToggle?()
    }
}
""")

# ============================================================
# llm-agent/TaskPlanList
# ============================================================
write_widget("llm-agent", "TaskPlanList", r"""import SwiftUI

// MARK: - Types

enum TaskStatus: String, CaseIterable { case pending, active, complete, failed, skipped }

struct PlanTask: Identifiable {
    let id: String
    let label: String
    let status: TaskStatus
    var result: String?
    var subtasks: [PlanTask]?
}

// MARK: - State Machine

enum TaskPlanListState { case idle, taskSelected, reordering }
enum TaskPlanListEvent {
    case expandTask(id: String), collapseTask(id: String), selectTask(id: String)
    case dragStart, deselect, drop, cancelDrag
}

func taskPlanListReduce(state: TaskPlanListState, event: TaskPlanListEvent) -> TaskPlanListState {
    switch state {
    case .idle:
        switch event {
        case .expandTask, .collapseTask: return .idle
        case .selectTask: return .taskSelected
        case .dragStart: return .reordering
        default: return state
        }
    case .taskSelected:
        switch event {
        case .deselect: return .idle
        case .selectTask: return .taskSelected
        default: return state
        }
    case .reordering:
        switch event {
        case .drop, .cancelDrag: return .idle
        default: return state
        }
    }
}

private let statusIcons: [TaskStatus: String] = [
    .pending: "\u{25CB}", .active: "\u{25CF}", .complete: "\u{2713}", .failed: "\u{2717}", .skipped: "\u{2298}"
]

private func countTasks(_ tasks: [PlanTask]) -> (complete: Int, total: Int) {
    var c = 0, t = 0
    for task in tasks {
        t += 1; if task.status == .complete { c += 1 }
        if let subs = task.subtasks { let s = countTasks(subs); c += s.complete; t += s.total }
    }
    return (c, t)
}

// MARK: - View

struct TaskPlanListView: View {
    let tasks: [PlanTask]
    let goalLabel: String
    let progress: Double
    var showProgress: Bool = true
    var allowReorder: Bool = true
    var onReorder: (([PlanTask]) -> Void)?

    @State private var widgetState: TaskPlanListState = .idle
    @State private var expandedSet: Set<String> = []
    @State private var selectedId: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(goalLabel).font(.headline).padding(.horizontal, 12).padding(.vertical, 8)

            if showProgress {
                let counts = countTasks(tasks)
                VStack(spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3).fill(Color.blue)
                                .frame(width: geo.size.width * CGFloat(min(max(progress, 0), 100) / 100))
                        }
                    }.frame(height: 6)
                    Text("\(counts.complete) of \(counts.total) tasks complete")
                        .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("\(counts.complete) of \(counts.total) tasks complete")
            }

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(tasks) { task in
                        taskRow(task, depth: 0)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task plan: \(goalLabel)")
    }

    @ViewBuilder
    private func taskRow(_ task: PlanTask, depth: Int) -> some View {
        let isExpanded = expandedSet.contains(task.id)
        let isSelected = selectedId == task.id
        let hasSubtasks = !(task.subtasks ?? []).isEmpty

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(statusIcons[task.status] ?? "\u{25CB}").font(.system(size: 14))
                    .foregroundColor(task.status == .active ? .blue : (task.status == .failed ? .red : .primary))
                Text(task.label).lineLimit(1)
                Spacer()
                if hasSubtasks {
                    Button(action: { toggleExpand(task.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
            }
            .padding(.leading, CGFloat(depth * 20))
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture {
                if selectedId == task.id {
                    selectedId = nil
                    widgetState = taskPlanListReduce(state: widgetState, event: .deselect)
                } else {
                    selectedId = task.id
                    widgetState = taskPlanListReduce(state: widgetState, event: .selectTask(id: task.id))
                }
            }
            .accessibilityLabel("\(task.label) \u{2014} \(task.status.rawValue.capitalized)")

            if isExpanded, let result = task.result {
                Text(result).font(.system(size: 13)).foregroundColor(.secondary)
                    .padding(.leading, CGFloat((depth + 1) * 20)).padding(.horizontal, 12).padding(.vertical, 4)
            }

            if isExpanded, let subs = task.subtasks {
                ForEach(subs) { sub in taskRow(sub, depth: depth + 1) }
            }
        }
    }

    private func toggleExpand(_ id: String) {
        if expandedSet.contains(id) { expandedSet.remove(id) } else { expandedSet.insert(id) }
    }
}
""")

# ============================================================
# llm-agent/ToolInvocation
# ============================================================
write_widget("llm-agent", "ToolInvocation", r"""import SwiftUI

// MARK: - State Machine

enum ToolInvocationViewState { case collapsed, hoveredCollapsed, expanded }
enum ToolInvocationExecState: String { case pending, running, succeeded, failed }

enum ToolInvocationViewEvent { case expand, collapse, hover, leave }
enum ToolInvocationExecEvent { case invoke, success, failure, retry, reset }

func toolViewReduce(state: ToolInvocationViewState, event: ToolInvocationViewEvent) -> ToolInvocationViewState {
    switch state {
    case .collapsed:
        switch event { case .expand: return .expanded; case .hover: return .hoveredCollapsed; default: return state }
    case .hoveredCollapsed:
        switch event { case .leave: return .collapsed; case .expand: return .expanded; default: return state }
    case .expanded:
        if case .collapse = event { return .collapsed }
        return state
    }
}

func toolExecReduce(state: ToolInvocationExecState, event: ToolInvocationExecEvent) -> ToolInvocationExecState {
    switch state {
    case .pending:
        if case .invoke = event { return .running }
        return state
    case .running:
        switch event { case .success: return .succeeded; case .failure: return .failed; default: return state }
    case .succeeded:
        if case .reset = event { return .pending }
        return state
    case .failed:
        switch event { case .retry: return .running; case .reset: return .pending; default: return state }
    }
}

private func statusToExec(_ s: String) -> ToolInvocationExecState {
    switch s { case "running": return .running; case "succeeded": return .succeeded; case "failed": return .failed; default: return .pending }
}

private let execIcons: [ToolInvocationExecState: String] = [
    .pending: "\u{2022}", .running: "\u{25CB}", .succeeded: "\u{2713}", .failed: "\u{2717}"
]

private let execLabels: [ToolInvocationExecState: String] = [
    .pending: "Pending", .running: "Running", .succeeded: "Succeeded", .failed: "Failed"
]

// MARK: - View

struct ToolInvocationView: View {
    let toolName: String
    let arguments: String
    var result: String?
    var status: String = "pending"
    var duration: Int?
    var onRetry: (() -> Void)?
    var defaultExpanded: Bool = false
    var showArguments: Bool = true
    var showResult: Bool = true
    var isDestructive: Bool = false

    @State private var viewState: ToolInvocationViewState = .collapsed
    @State private var execState: ToolInvocationExecState = .pending

    private var isExpanded: Bool { viewState == .expanded }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button(action: toggleExpand) {
                HStack(spacing: 8) {
                    Text("\u{2699}").font(.system(size: 16))
                    Text(toolName).fontWeight(.medium)
                    if isDestructive {
                        Text("\u{26A0}").foregroundColor(.orange).accessibilityLabel("Destructive tool")
                    }
                    Spacer()
                    Text(execIcons[execState] ?? "").foregroundColor(execState == .failed ? .red : .primary)
                    if let d = duration { Text("\(d)ms").font(.caption).foregroundColor(.secondary) }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(toolName) \u{2014} \(execLabels[execState] ?? "")")

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    if showArguments {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Arguments").font(.caption).foregroundColor(.secondary)
                            Text(formatJson(arguments)).font(.system(size: 12, design: .monospaced))
                                .padding(8).background(Color.gray.opacity(0.08)).cornerRadius(4)
                        }
                    }

                    if showResult, let r = result {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Result").font(.caption).foregroundColor(.secondary)
                            Text(formatJson(r)).font(.system(size: 12, design: .monospaced))
                                .padding(8).background(Color.gray.opacity(0.08)).cornerRadius(4)
                        }
                    }

                    if execState == .failed {
                        Button("Retry") {
                            execState = toolExecReduce(state: execState, event: .retry)
                            onRetry?()
                        }.font(.caption).accessibilityLabel("Retry tool call")
                    }
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
            }
        }
        .onAppear {
            viewState = defaultExpanded ? .expanded : .collapsed
            execState = statusToExec(status)
        }
        .onChange(of: status) { s in execState = statusToExec(s) }
        .onHover { h in
            if h { viewState = toolViewReduce(state: viewState, event: .hover) }
            else { viewState = toolViewReduce(state: viewState, event: .leave) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tool call: \(toolName)")
    }

    private func toggleExpand() {
        viewState = isExpanded
            ? toolViewReduce(state: viewState, event: .collapse)
            : toolViewReduce(state: viewState, event: .expand)
    }

    private func formatJson(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
              let str = String(data: pretty, encoding: .utf8) else { return raw }
        return str
    }
}
""")

# ============================================================
# llm-agent/TraceTree
# ============================================================
write_widget("llm-agent", "TraceTree", r"""import SwiftUI

// MARK: - Types

struct TraceSpan: Identifiable {
    let id: String
    let type: String
    let label: String
    let duration: Int
    var tokens: Int?
    let status: String
    var children: [TraceSpan]?
}

// MARK: - State Machine

enum TraceTreeState { case idle, spanSelected }
enum TraceTreeEvent {
    case selectSpan(id: String), deselect, expand(id: String), collapse(id: String), filter(spanType: String)
}

func traceTreeReduce(state: TraceTreeState, event: TraceTreeEvent) -> TraceTreeState {
    switch state {
    case .idle:
        if case .selectSpan = event { return .spanSelected }
        return state
    case .spanSelected:
        switch event {
        case .deselect: return .idle
        case .selectSpan: return .spanSelected
        default: return state
        }
    }
}

private let spanTypeLabels: [String: String] = ["llm": "LLM", "tool": "Tool", "chain": "Chain", "agent": "Agent"]
private let spanTypeIcons: [String: String] = ["llm": "\u{1F9E0}", "tool": "\u{2699}", "chain": "\u{1F517}", "agent": "\u{1F916}"]
private let spanStatusIcons: [String: String] = ["success": "\u{2713}", "running": "\u{25CB}", "error": "\u{2717}", "pending": "\u{2022}"]

private func findSpan(_ spans: [TraceSpan], id: String) -> TraceSpan? {
    for s in spans {
        if s.id == id { return s }
        if let c = s.children, let f = findSpan(c, id: id) { return f }
    }
    return nil
}

// MARK: - View

struct TraceTreeView: View {
    let spans: [TraceSpan]
    let rootLabel: String
    var totalDuration: Int?
    var totalTokens: Int?
    var onSelectSpan: ((String?) -> Void)?
    var showMetrics: Bool = true

    @State private var widgetState: TraceTreeState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []
    @State private var visibleTypes: Set<String> = ["llm", "tool", "chain", "agent"]

    private var selectedSpan: TraceSpan? {
        guard let sid = selectedId else { return nil }
        return findSpan(spans, id: sid)
    }

    private var availableTypes: [String] {
        var types: Set<String> = []
        func walk(_ nodes: [TraceSpan]) { for s in nodes { types.insert(s.type); if let c = s.children { walk(c) } } }
        walk(spans); return Array(types).sorted()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(rootLabel).font(.headline)
                Spacer()
                if showMetrics, let d = totalDuration { Text("\(d)ms").font(.caption).foregroundColor(.secondary) }
                if showMetrics, let t = totalTokens { Text("\(t) tokens").font(.caption).foregroundColor(.secondary) }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Filter bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(availableTypes, id: \.self) { t in
                        Button("\(spanTypeLabels[t] ?? t)") {
                            if visibleTypes.contains(t) { visibleTypes.remove(t) } else { visibleTypes.insert(t) }
                        }
                        .font(.system(size: 12))
                        .fontWeight(visibleTypes.contains(t) ? .semibold : .regular)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(visibleTypes.contains(t) ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4).buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.bottom, 6)

            Divider()

            HStack(alignment: .top, spacing: 0) {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(spans.filter { visibleTypes.contains($0.type) }) { span in
                            spanNode(span, depth: 0)
                        }
                    }
                }

                if widgetState == .spanSelected, let span = selectedSpan {
                    Divider()
                    detailPanel(span).frame(width: 240)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution trace")
    }

    @ViewBuilder
    private func spanNode(_ span: TraceSpan, depth: Int) -> some View {
        let isExpanded = expandedIds.contains(span.id)
        let isSelected = selectedId == span.id
        let hasChildren = !(span.children ?? []).isEmpty
        let visibleChildren = (span.children ?? []).filter { visibleTypes.contains($0.type) }

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                if hasChildren {
                    Button(action: { toggleExpand(span.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
                Text(spanTypeIcons[span.type] ?? "\u{25CF}").font(.system(size: 12))
                Text(span.label).lineLimit(1)
                Text("\(span.duration)ms").font(.caption).foregroundColor(.secondary)
                if showMetrics, let t = span.tokens { Text("\(t) tok").font(.caption2).foregroundColor(.secondary) }
                Spacer()
                Text(spanStatusIcons[span.status] ?? "\u{2022}")
                    .foregroundColor(span.status == "error" ? .red : .primary)
            }
            .padding(.leading, CGFloat(depth * 16))
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture { selectSpan(span.id) }
            .accessibilityLabel("\(span.type): \(span.label) (\(span.duration)ms)")

            if hasChildren && isExpanded {
                ForEach(visibleChildren) { child in spanNode(child, depth: depth + 1) }
            }
        }
    }

    @ViewBuilder
    private func detailPanel(_ span: TraceSpan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(spanTypeIcons[span.type] ?? "") \(spanTypeLabels[span.type] ?? span.type)").font(.caption).foregroundColor(.secondary)
                Spacer()
                Button(action: { deselectSpan() }) { Text("\u{2715}") }.buttonStyle(.plain)
            }
            Group {
                labelValue("Label", span.label)
                labelValue("Status", "\(spanStatusIcons[span.status] ?? "") \(span.status)")
                labelValue("Duration", "\(span.duration)ms")
                if let t = span.tokens { labelValue("Tokens", "\(t)") }
                if let c = span.children, !c.isEmpty { labelValue("Children", "\(c.count) spans") }
            }
            Spacer()
        }.padding()
    }

    @ViewBuilder
    private func labelValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundColor(.secondary)
            Text(value).font(.system(size: 13))
        }
    }

    private func selectSpan(_ id: String) {
        if selectedId == id { deselectSpan(); return }
        selectedId = id
        widgetState = traceTreeReduce(state: widgetState, event: .selectSpan(id: id))
        onSelectSpan?(id)
    }

    private func deselectSpan() {
        selectedId = nil
        widgetState = traceTreeReduce(state: widgetState, event: .deselect)
        onSelectSpan?(nil)
    }

    private func toggleExpand(_ id: String) {
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
    }
}
""")

print("\nDone with governance-structure + llm-agent (10 widgets)")
