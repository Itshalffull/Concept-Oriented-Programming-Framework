// ============================================================
// Clef Surface WatchKit Widget — Accordion
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct AccordionView: View {
    struct Section: Identifiable { let id = UUID(); let title: String; let content: AnyView; var isExpanded: Bool = false }
    @State var sections: [Section]
    var body: some View {
        ScrollView { VStack(spacing: 2) { ForEach(sections.indices, id: \.self) { i in
            Button(action: { withAnimation { sections[i].isExpanded.toggle() } }) { HStack { Text(sections[i].title).font(.caption.bold()); Spacer(); Image(systemName: sections[i].isExpanded ? "chevron.up" : "chevron.down").font(.caption2) } }
            if sections[i].isExpanded { sections[i].content.padding(.leading, 8) }
        } } }
    }
}
