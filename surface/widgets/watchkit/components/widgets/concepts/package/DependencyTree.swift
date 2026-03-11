import SwiftUI

// State machine: idle | nodeSelected
enum DependencyTreeWatchState {
    case idle
    case nodeSelected
}

enum DependencyTreeWatchEvent {
    case selectNode
    case deselect
}

func dependencyTreeWatchReduce(_ state: DependencyTreeWatchState, _ event: DependencyTreeWatchEvent) -> DependencyTreeWatchState {
    switch state {
    case .idle:
        if case .selectNode = event { return .nodeSelected }
        return state
    case .nodeSelected:
        if case .deselect = event { return .idle }
        if case .selectNode = event { return .nodeSelected }
        return state
    }
}

struct DependencyNodeData: Identifiable {
    let id: String
    let name: String
    let version: String
    var depth: Int = 0
    var hasVulnerability: Bool = false
    var isOutdated: Bool = false
    var childCount: Int = 0
    var license: String? = nil
}

struct DependencyTreeWatchView: View {
    let nodes: [DependencyNodeData]
    var title: String = "Dependencies"
    var onSelect: ((String) -> Void)? = nil

    @State private var state: DependencyTreeWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []

    private var visibleNodes: [DependencyNodeData] {
        // Show root nodes and expanded children
        var result: [DependencyNodeData] = []
        var skipDepth: Int? = nil
        for node in nodes {
            if let skip = skipDepth {
                if node.depth > skip { continue }
                skipDepth = nil
            }
            result.append(node)
            if node.childCount > 0 && !expandedIds.contains(node.id) {
                skipDepth = node.depth
            }
        }
        return result
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Header
                HStack {
                    Text(title)
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(nodes.count) packages")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Tree list
                ForEach(visibleNodes) { node in
                    Button {
                        if node.childCount > 0 {
                            if expandedIds.contains(node.id) {
                                expandedIds.remove(node.id)
                            } else {
                                expandedIds.insert(node.id)
                            }
                        }
                        if selectedId == node.id {
                            selectedId = nil
                            state = dependencyTreeWatchReduce(state, .deselect)
                        } else {
                            selectedId = node.id
                            state = dependencyTreeWatchReduce(state, .selectNode)
                            onSelect?(node.id)
                        }
                    } label: {
                        HStack(spacing: 3) {
                            // Indentation
                            if node.depth > 0 {
                                Spacer()
                                    .frame(width: CGFloat(min(node.depth, 3) * 8))
                            }

                            // Expand indicator
                            if node.childCount > 0 {
                                Image(systemName: expandedIds.contains(node.id) ? "chevron.down" : "chevron.right")
                                    .font(.system(size: 7))
                                    .foregroundColor(.secondary)
                            } else {
                                Image(systemName: "circle.fill")
                                    .font(.system(size: 3))
                                    .foregroundColor(.secondary)
                                    .frame(width: 8)
                            }

                            // Package name
                            Text(node.name)
                                .font(.system(size: 9))
                                .lineLimit(1)

                            // Version
                            Text(node.version)
                                .font(.system(size: 7, design: .monospaced))
                                .foregroundColor(.secondary)

                            Spacer()

                            // Warning icons
                            if node.hasVulnerability {
                                Image(systemName: "exclamationmark.shield.fill")
                                    .font(.system(size: 7))
                                    .foregroundColor(.red)
                            }
                            if node.isOutdated {
                                Image(systemName: "arrow.up.circle")
                                    .font(.system(size: 7))
                                    .foregroundColor(.orange)
                            }
                        }
                        .padding(.vertical, 2)
                        .background(selectedId == node.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == node.id {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(node.name)@\(node.version)")
                                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                            if let license = node.license {
                                Text("License: \(license)")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                            if node.childCount > 0 {
                                Text("\(node.childCount) dependencies")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                            if node.hasVulnerability {
                                Text("Vulnerability detected")
                                    .font(.system(size: 8))
                                    .foregroundColor(.red)
                            }
                            if node.isOutdated {
                                Text("Update available")
                                    .font(.system(size: 8))
                                    .foregroundColor(.orange)
                            }
                        }
                        .padding(4)
                        .padding(.leading, CGFloat(min(node.depth + 1, 4) * 8))
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(3)
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dependency tree, \(nodes.count) packages")
    }
}
