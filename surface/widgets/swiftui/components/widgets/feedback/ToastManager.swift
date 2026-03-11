// ============================================================
// Clef Surface SwiftUI Widget — ToastManager
//
// Container that manages a stack of toast notifications.
// Controls ordering, maximum visible count, and lifecycle.
// Auto-dismisses toasts after their configured duration.
//
// Adapts the toast-manager.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ToastItem: Identifiable {
    let id: String
    var variant: ToastVariant = .info
    let title: String
    var description: String? = nil
    var duration: TimeInterval = 5.0
}

// --------------- State ---------------

@Observable
class ToastManagerState {
    var toasts: [ToastItem] = []

    func show(_ toast: ToastItem) {
        toasts.append(toast)
    }

    func dismiss(_ id: String) {
        toasts.removeAll { $0.id == id }
    }

    func clear() {
        toasts.removeAll()
    }
}

// --------------- Component ---------------

/// ToastManager view that manages and renders a stack of toasts.
///
/// - Parameters:
///   - state: The ToastManagerState controlling the toast lifecycle.
///   - maxVisible: Maximum number of visible toasts at once.
///   - alignment: Alignment of the toast stack.
struct ToastManagerView: View {
    @Bindable var state: ToastManagerState
    var maxVisible: Int = 5
    var alignment: Alignment = .bottom

    var body: some View {
        if !state.toasts.isEmpty {
            VStack(spacing: 4) {
                let visible = Array(state.toasts.prefix(maxVisible))
                let overflowCount = max(state.toasts.count - maxVisible, 0)

                ForEach(visible) { toast in
                    ToastView(
                        variant: toast.variant,
                        title: toast.title,
                        description: toast.description,
                        onDismiss: { state.dismiss(toast.id) }
                    )
                    .onAppear {
                        if toast.duration > 0 {
                            DispatchQueue.main.asyncAfter(deadline: .now() + toast.duration) {
                                state.dismiss(toast.id)
                            }
                        }
                    }
                }

                if overflowCount > 0 {
                    Text("+\(overflowCount) more notification(s)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
        }
    }
}
