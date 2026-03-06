import SwiftUI

enum DependencyTreeWidgetState {
    case idle, nodeSelected, filtering
}

enum DependencyTreeEvent {
    case select, expand, collapse, search, filterScope, deselect, clear
}

func dependencyTreeReduce(state: DependencyTreeWidgetState, event: DependencyTreeEvent) -> DependencyTreeWidgetState {
    switch state {
    case .idle:
        if event == .select { return .nodeSelected }
        if event == .search { return .filtering }
        return state
    case .nodeSelected:
        if event == .deselect { return .idle }
        if event == .select { return .nodeSelected }
        return state
    case .filtering:
        if event == .clear { return .idle }
        return state
    }
}

struct DepNode: Identifiable {
    let id = UUID()
    var name: String
    var version: String
    var resolved: String? = nil
    var type: String = "prod" // "prod", "dev", "peer", "optional"
    var dependencies: [DepNode]? = nil
}

struct DependencyTreeView: View {
    var root: DepNode
    var expandDepth: Int = 2
    var showDevDeps: Bool = true
    var selectedPackage: String? = nil

    @State private var widgetState: DependencyTreeWidgetState = .idle
    @State private var searchQuery: String = ""
    @State private var scopeFilter: String = "all"
    @State private var selectedName: String? = nil

    private let scopeOptions = ["all", "prod", "dev", "peer", "optional"]

    private var visibleDeps: [DepNode] {
        let deps = root.dependencies ?? []
        if showDevDeps { return deps }
        return deps.filter { ($0.type) != "dev" }
    }

    private func countByType(_ nodes: [DepNode]) -> [String: Int] {
        var counts: [String: Int] = ["prod": 0, "dev": 0, "peer": 0, "optional": 0, "total": 0]
        func walk(_ deps: [DepNode]) {
            for dep in deps {
                let t = dep.type
                counts[t, default: 0] += 1
                counts["total", default: 0] += 1
                if let children = dep.dependencies { walk(children) }
            }
        }
        walk(nodes)
        return counts
    }

    private func matchesScope(_ node: DepNode) -> Bool {
        if scopeFilter == "all" { return true }
        return node.type == scopeFilter
    }

    private func matchesSearch(_ node: DepNode) -> Bool {
        if searchQuery.isEmpty { return true }
        let q = searchQuery.lowercased()
        if node.name.lowercased().contains(q) { return true }
        if node.version.lowercased().contains(q) { return true }
        if let deps = node.dependencies {
            return deps.contains { matchesSearch($0) }
        }
        return false
    }

    private func collectVersions(_ nodes: [DepNode]) -> [String: [String]] {
        var map: [String: [String]] = [:]
        func walk(_ deps: [DepNode]) {
            for dep in deps {
                map[dep.name, default: []].append(dep.version)
                if let children = dep.dependencies { walk(children) }
            }
        }
        walk(nodes)
        return map
    }

    var body: some View {
        let counts = countByType(visibleDeps)
        let packageMap = collectVersions(visibleDeps)

        VStack(alignment: .leading, spacing: 8) {
            // Search bar
            TextField("Search dependencies...", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Search dependencies")
                .onChange(of: searchQuery) { newVal in
                    if newVal.isEmpty {
                        widgetState = dependencyTreeReduce(state: widgetState, event: .clear)
                    } else {
                        widgetState = .idle
                        widgetState = dependencyTreeReduce(state: widgetState, event: .search)
                    }
                }

            // Scope filter chips
            HStack(spacing: 4) {
                ForEach(scopeOptions, id: \.self) { scope in
                    Button(scope) {
                        scopeFilter = scope
                    }
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(scopeFilter == scope ? Color.accentColor.opacity(0.2) : Color.clear)
                    .overlay(Capsule().stroke(scopeFilter == scope ? Color.accentColor : Color.gray.opacity(0.3), lineWidth: 1))
                    .cornerRadius(12)
                    .accessibilityLabel("Filter: \(scope)")
                    .accessibilityValue(scopeFilter == scope ? "selected" : "")
                }
            }

            // Summary
            let summaryParts = ["prod", "dev", "peer", "optional"].compactMap { t -> String? in
                let c = counts[t] ?? 0
                return c > 0 ? "\(c) \(t)" : nil
            }
            Text("\(counts["total"] ?? 0) packages" + (summaryParts.isEmpty ? "" : " (\(summaryParts.joined(separator: ", ")))"))
                .font(.caption)
                .foregroundColor(.secondary)

            // Tree
            List {
                ForEach(visibleDeps.filter { matchesScope($0) && matchesSearch($0) }) { dep in
                    DepTreeNodeView(
                        node: dep,
                        depth: 0,
                        expandDepth: expandDepth,
                        packageMap: packageMap,
                        selectedName: $selectedName,
                        scopeFilter: scopeFilter,
                        searchQuery: searchQuery,
                        matchesScope: matchesScope,
                        matchesSearch: matchesSearch,
                        onSelect: { name in
                            if selectedName == name {
                                selectedName = nil
                                widgetState = dependencyTreeReduce(state: .nodeSelected, event: .deselect)
                            } else {
                                selectedName = name
                                widgetState = .idle
                                widgetState = dependencyTreeReduce(state: widgetState, event: .select)
                            }
                        }
                    )
                }
            }
            .listStyle(.plain)

            // Detail panel
            if let name = selectedName, widgetState == .nodeSelected {
                let node = findNode(name: name, in: visibleDeps)
                if let node = node {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(node.name).font(.headline)
                        Text("Version: \(node.version)").font(.caption)
                        if let resolved = node.resolved {
                            Text("Resolved: \(resolved)").font(.caption)
                        }
                        Text("Type: \(node.type)").font(.caption)
                        if let deps = node.dependencies, !deps.isEmpty {
                            Text("Direct dependencies: \(deps.count)").font(.caption)
                        }
                        let versions = packageMap[node.name] ?? []
                        let unique = Array(Set(versions))
                        if unique.count > 1 {
                            Text("Version conflict: \(unique.joined(separator: ", "))")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                    .padding(12)
                    .overlay(
                        Rectangle().fill(Color.gray.opacity(0.2)).frame(width: 1),
                        alignment: .leading
                    )
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dependencies for \(root.name)")
        .onAppear {
            selectedName = selectedPackage
            if selectedPackage != nil {
                widgetState = .nodeSelected
            }
        }
    }

    private func findNode(name: String, in nodes: [DepNode]) -> DepNode? {
        for n in nodes {
            if n.name == name { return n }
            if let children = n.dependencies, let found = findNode(name: name, in: children) {
                return found
            }
        }
        return nil
    }
}

private struct DepTreeNodeView: View {
    let node: DepNode
    let depth: Int
    let expandDepth: Int
    let packageMap: [String: [String]]
    @Binding var selectedName: String?
    let scopeFilter: String
    let searchQuery: String
    let matchesScope: (DepNode) -> Bool
    let matchesSearch: (DepNode) -> Bool
    let onSelect: (String) -> Void

    @State private var expanded: Bool = false

    var body: some View {
        let versions = packageMap[node.name] ?? []
        let isDuplicate = versions.count > 1
        let hasConflict = isDuplicate && Set(versions).count > 1
        let hasChildren = node.dependencies != nil && !(node.dependencies!.isEmpty)

        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if hasChildren {
                    Button {
                        withAnimation { expanded.toggle() }
                    } label: {
                        Image(systemName: expanded ? "chevron.down" : "chevron.right")
                            .font(.caption2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(expanded ? "Collapse" : "Expand")
                } else {
                    Spacer().frame(width: 12)
                }

                Text(node.name)
                    .fontWeight(selectedName == node.name ? .bold : .regular)

                Text("@\(node.version)")
                    .font(.caption)
                    .opacity(0.8)

                Text(node.type)
                    .font(.caption2)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .overlay(RoundedRectangle(cornerRadius: 3).stroke(Color.secondary.opacity(0.5), lineWidth: 1))

                if hasConflict {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                        .font(.caption)
                        .accessibilityLabel("Version conflict")
                }

                if isDuplicate {
                    Text("x\(versions.count)")
                        .font(.caption2)
                        .opacity(0.7)
                        .accessibilityLabel("Appears \(versions.count) times")
                }
            }
            .padding(.leading, CGFloat(depth * 20))
            .contentShape(Rectangle())
            .onTapGesture { onSelect(node.name) }

            if hasChildren && expanded {
                let filtered = node.dependencies!.filter { matchesScope($0) && matchesSearch($0) }
                ForEach(filtered) { child in
                    DepTreeNodeView(
                        node: child,
                        depth: depth + 1,
                        expandDepth: expandDepth,
                        packageMap: packageMap,
                        selectedName: $selectedName,
                        scopeFilter: scopeFilter,
                        searchQuery: searchQuery,
                        matchesScope: matchesScope,
                        matchesSearch: matchesSearch,
                        onSelect: onSelect
                    )
                }
            }
        }
        .accessibilityLabel("\(node.name)@\(node.version)")
        .onAppear {
            expanded = depth < expandDepth
        }
    }
}
