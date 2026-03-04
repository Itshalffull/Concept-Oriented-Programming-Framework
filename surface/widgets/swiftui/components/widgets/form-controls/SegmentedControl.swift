// ============================================================
// Clef Surface SwiftUI Widget — SegmentedControl
//
// Inline single-choice control displayed as a row of connected
// segments using SwiftUI Picker with segmented style.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct SegmentedControlOption: Identifiable {
    let id: String
    let label: String
    let value: String

    init(label: String, value: String) {
        self.id = value
        self.label = label
        self.value = value
    }
}

enum SegmentedControlSize { case sm, md, lg }

// --------------- Component ---------------

/// SegmentedControl view for inline single-choice selection.
///
/// - Parameters:
///   - value: Binding to the selected value.
///   - options: Available segment options.
///   - size: Size controlling text style.
///   - enabled: Whether the control is enabled.
struct SegmentedControlView: View {
    @Binding var value: String?
    var options: [SegmentedControlOption]
    var size: SegmentedControlSize = .md
    var enabled: Bool = true

    var body: some View {
        Picker("", selection: Binding(
            get: { value ?? "" },
            set: { value = $0 }
        )) {
            ForEach(options) { option in
                Text(option.label)
                    .font(fontSize)
                    .tag(option.value)
            }
        }
        .pickerStyle(.segmented)
        .disabled(!enabled)
    }

    private var fontSize: Font {
        switch size {
        case .sm: return .caption
        case .md: return .subheadline
        case .lg: return .body
        }
    }
}
