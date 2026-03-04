// ============================================================
// Clef Surface SwiftUI Widget — ViewSwitcher
//
// Component for switching between multiple named views/layouts.
// Shows a toolbar of view options and renders the selected view.
// ============================================================

import SwiftUI

struct ViewOption: Identifiable {
    let id: String
    let label: String
    var icon: String? = nil
}

struct ViewSwitcherView<Content: View>: View {
    var options: [ViewOption]
    @Binding var activeId: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                ForEach(options) { option in
                    SwiftUI.Button(action: { activeId = option.id }) {
                        HStack(spacing: 4) {
                            if let icon = option.icon { Image(systemName: icon) }
                            Text(option.label).font(.subheadline)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(option.id == activeId ? Color.accentColor.opacity(0.1) : Color.clear)
                        .foregroundColor(option.id == activeId ? .accentColor : .secondary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }.buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(8)
            .background(Color(.systemGray6))

            content
        }
    }
}
