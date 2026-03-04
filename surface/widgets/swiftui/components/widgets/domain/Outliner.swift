// ============================================================
// Clef Surface SwiftUI Widget — Outliner
//
// Infinitely nested bullet-list outliner rendered as a
// ScrollView with indented tree items. Supports
// collapse/expand toggles, selection, and indent/outdent
// actions.
// ============================================================

import SwiftUI

struct OutlinerItem: Identifiable {
    let id: String
    let text: String
    let level: Int
    var collapsed: Bool = false
}

private func getVisibleItems(_ items: [OutlinerItem]) -> [OutlinerItem] {
    var visible: [OutlinerItem] = []
    var skipLevel = -1

    for item in items {
        if skipLevel >= 0 && item.level > skipLevel {
            continue
        }
        skipLevel = -1
        visible.append(item)
        if item.collapsed {
            skipLevel = item.level
        }
    }

    return visible
}

private func hasChildren(_ items: [OutlinerItem], at index: Int) -> Bool {
    guard index < items.count - 1 else { return false }
    return items[index + 1].level > items[index].level
}

struct OutlinerView: View {
    var items: [OutlinerItem]
    var selectedId: String? = nil
    var onSelect: (String) -> Void = { _ in }
    var onToggle: (String) -> Void = { _ in }
    var onIndent: (String) -> Void = { _ in }
    var onOutdent: (String) -> Void = { _ in }

    var body: some View {
        if items.isEmpty {
            Text("New item...")
                .font(.body)
                .foregroundColor(.secondary)
                .padding(16)
        } else {
            let visibleItems = getVisibleItems(items)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(visibleItems) { item in
                        let isSelected = item.id == selectedId
                        let originalIndex = items.firstIndex(where: { $0.id == item.id }) ?? -1
                        let itemHasChildren = originalIndex >= 0 ? hasChildren(items, at: originalIndex) : false
                        let indent = CGFloat(item.level * 24)

                        HStack(spacing: 0) {
                            // Collapse/expand or bullet
                            if itemHasChildren {
                                SwiftUI.Button(action: { onToggle(item.id) }) {
                                    Image(systemName: item.collapsed ? "chevron.right" : "chevron.down")
                                        .foregroundColor(isSelected ? .accentColor : .secondary)
                                        .frame(width: 24, height: 24)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(item.collapsed ? "Expand" : "Collapse")
                            } else {
                                Text("\u{2022}")
                                    .foregroundColor(.secondary)
                                    .frame(width: 24, height: 24)
                            }

                            SwiftUI.Button(action: { onSelect(item.id) }) {
                                Text(item.text)
                                    .font(.body)
                                    .fontWeight(isSelected ? .bold : .regular)
                                    .foregroundColor(isSelected ? .accentColor : .primary)
                            }
                            .buttonStyle(.plain)

                            Spacer()
                        }
                        .padding(.leading, indent)
                        .padding(.vertical, 2)
                        .padding(.trailing, 4)
                        .accessibilityLabel("Level \(item.level + 1): \(item.text)")
                    }
                }
            }
            .padding(8)
        }
    }
}
