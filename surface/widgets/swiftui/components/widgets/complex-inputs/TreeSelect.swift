// ============================================================
// Clef Surface SwiftUI Widget — TreeSelect
//
// Hierarchical tree selection control with expandable nodes
// and checkbox or radio selection.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct TreeNode: Identifiable {
    let id: String
    let label: String
    var children: [TreeNode] = []
    var disabled: Bool = false
}

// --------------- Component ---------------

/// TreeSelect view for hierarchical selection.
///
/// - Parameters:
///   - nodes: Root nodes of the tree.
///   - selected: Binding to the set of selected node IDs.
///   - multiple: Whether multiple nodes can be selected.
struct TreeSelectView: View {
    var nodes: [TreeNode]
    @Binding var selected: Set<String>
    var multiple: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(nodes) { node in
                TreeNodeView(
                    node: node,
                    selected: $selected,
                    multiple: multiple,
                    depth: 0
                )
            }
        }
    }
}

private struct TreeNodeView: View {
    let node: TreeNode
    @Binding var selected: Set<String>
    let multiple: Bool
    let depth: Int

    @State private var expanded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                if !node.children.isEmpty {
                    SwiftUI.Button(action: { expanded.toggle() }) {
                        Image(systemName: expanded ? "chevron.down" : "chevron.right")
                            .font(.caption)
                            .frame(width: 20)
                    }
                    .buttonStyle(.plain)
                } else {
                    Spacer().frame(width: 20)
                }

                let isSelected = selected.contains(node.id)
                SwiftUI.Button(action: {
                    guard !node.disabled else { return }
                    if multiple {
                        if isSelected {
                            selected.remove(node.id)
                        } else {
                            selected.insert(node.id)
                        }
                    } else {
                        selected = [node.id]
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                            .foregroundColor(node.disabled ? .gray : .accentColor)
                        Text(node.label)
                            .font(.body)
                            .foregroundColor(node.disabled ? .gray : .primary)
                    }
                }
                .buttonStyle(.plain)
                .disabled(node.disabled)
            }
            .padding(.leading, CGFloat(depth) * 20)
            .padding(.vertical, 4)

            if expanded {
                ForEach(node.children) { child in
                    TreeNodeView(
                        node: child,
                        selected: $selected,
                        multiple: multiple,
                        depth: depth + 1
                    )
                }
            }
        }
    }
}
