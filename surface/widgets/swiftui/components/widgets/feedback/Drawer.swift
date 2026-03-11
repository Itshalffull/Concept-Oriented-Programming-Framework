// ============================================================
// Clef Surface SwiftUI Widget — Drawer
//
// Slide-in panel that overlays the page content. Supports
// placement on the leading or trailing edge with configurable
// width, title bar, and close button.
//
// Adapts the drawer.widget spec to SwiftUI rendering via sheet.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum DrawerPosition { case leading, trailing }

// --------------- Component ---------------

/// Drawer view rendered as a slide-in panel overlay.
///
/// - Parameters:
///   - open: Binding to whether the drawer is visible.
///   - position: Edge from which the drawer slides in.
///   - title: Title displayed in the drawer header.
///   - onClose: Callback fired when the drawer is closed.
///   - drawerWidth: Width of the drawer panel.
///   - drawerContent: Content rendered inside the drawer body.
struct DrawerView<DrawerContent: View>: View {
    @Binding var open: Bool
    var position: DrawerPosition = .trailing
    var title: String? = nil
    var onClose: (() -> Void)? = nil
    var drawerWidth: CGFloat = 300
    @ViewBuilder var drawerContent: DrawerContent

    var body: some View {
        ZStack(alignment: position == .leading ? .leading : .trailing) {
            if open {
                // Scrim
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        open = false
                        onClose?()
                    }

                // Drawer panel
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack {
                        if let title = title {
                            Text(title)
                                .font(.title3)
                                .fontWeight(.semibold)
                        }
                        Spacer()
                        SwiftUI.Button(action: {
                            open = false
                            onClose?()
                        }) {
                            Image(systemName: "xmark")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Close drawer")
                    }
                    .padding(.bottom, 8)

                    Divider()
                        .padding(.bottom, 16)

                    // Body
                    drawerContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                .padding(16)
                .frame(width: drawerWidth)
                .frame(maxHeight: .infinity)
                .background(Color(.systemBackground))
                .transition(.move(edge: position == .leading ? .leading : .trailing))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: open)
    }
}
