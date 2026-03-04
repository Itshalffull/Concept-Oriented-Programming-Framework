// ============================================================
// Clef Surface WatchKit Widget — PinInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PinInputView: View {
    @Binding var pin: String; var length: Int = 4
    var body: some View { HStack(spacing: 4) { ForEach(0..<length, id: \.self) { i in
        let char = i < pin.count ? String(pin[pin.index(pin.startIndex, offsetBy: i)]) : ""
        Text(char).font(.title3.monospacedDigit()).frame(width: 28, height: 36).background(Color.gray.opacity(0.2)).cornerRadius(6)
    } } }
}
