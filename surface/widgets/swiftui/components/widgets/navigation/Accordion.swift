// ============================================================
// Clef Surface SwiftUI Widget — Accordion
//
// Vertically stacked collapsible sections. Each section has a
// trigger heading and expandable content panel with animation.
// Supports single or multiple expanded sections.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct AccordionItem: Identifiable {
    let id: String
    let title: String
    let content: String
}

// --------------- Component ---------------

/// Accordion view with vertically stacked collapsible sections.
///
/// - Parameters:
///   - items: Array of collapsible sections.
///   - multiple: Allow multiple sections open simultaneously.
///   - defaultOpen: IDs of initially expanded sections.
///   - onChange: Callback when expanded sections change.
struct AccordionView: View {
    var items: [AccordionItem]
    var multiple: Bool = false
    var defaultOpen: [String] = []
    var onChange: (([String]) -> Void)? = nil

    @State private var openIds: Set<String> = []

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                let isOpen = openIds.contains(item.id)

                // Trigger row
                SwiftUI.Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if isOpen {
                            openIds.remove(item.id)
                        } else {
                            if multiple {
                                openIds.insert(item.id)
                            } else {
                                openIds = [item.id]
                            }
                        }
                        onChange?(Array(openIds))
                    }
                }) {
                    HStack {
                        Text(item.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .rotationEffect(.degrees(isOpen ? 180 : 0))
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 12)
                    .padding(.horizontal, 16)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityHint(isOpen ? "Collapse" : "Expand")

                // Expandable content
                if isOpen {
                    Text(item.content)
                        .font(.body)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                        .transition(.opacity)
                }

                if index < items.count - 1 {
                    Divider()
                }
            }
        }
        .onAppear {
            openIds = Set(defaultOpen)
        }
    }
}
