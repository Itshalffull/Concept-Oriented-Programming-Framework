// ============================================================
// Clef Surface SwiftUI Widget — PinInput
//
// PIN/OTP code input with individual character fields.
// Each digit is entered in a separate box.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// PinInput view for PIN/OTP code entry.
///
/// - Parameters:
///   - value: Binding to the PIN string.
///   - length: Number of PIN digits.
///   - masked: Whether to mask the input (like a password).
///   - enabled: Whether the input is enabled.
///   - onComplete: Callback when all digits are entered.
struct PinInputView: View {
    @Binding var value: String
    var length: Int = 4
    var masked: Bool = false
    var enabled: Bool = true
    var onComplete: ((String) -> Void)? = nil

    @FocusState private var focusedIndex: Int?

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<length, id: \.self) { index in
                let char = index < value.count
                    ? String(value[value.index(value.startIndex, offsetBy: index)])
                    : ""

                Text(masked && !char.isEmpty ? "\u{2022}" : char)
                    .font(.title2)
                    .fontWeight(.bold)
                    .frame(width: 44, height: 52)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(
                                focusedIndex == index ? Color.accentColor : Color(.systemGray4),
                                lineWidth: focusedIndex == index ? 2 : 1
                            )
                    )
            }
        }
        .overlay(
            TextField("", text: $value)
                .opacity(0.01)
                .focused($focusedIndex, equals: 0)
                .disabled(!enabled)
                .onChange(of: value) { _, newValue in
                    let cleaned = String(newValue.prefix(length))
                    if cleaned != newValue {
                        value = cleaned
                    }
                    if cleaned.count == length {
                        onComplete?(cleaned)
                    }
                }
                #if os(iOS)
                .keyboardType(.numberPad)
                #endif
        )
        .onTapGesture {
            focusedIndex = 0
        }
        .accessibilityLabel("PIN input")
    }
}
