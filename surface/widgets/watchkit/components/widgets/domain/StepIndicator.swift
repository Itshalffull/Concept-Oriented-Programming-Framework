// ============================================================
// Clef Surface WatchKit Widget - StepIndicator
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct StepIndicatorView: View {
    var steps: [String] = []; var currentStep: Int = 0
    var body: some View {
        HStack(spacing: 4) { ForEach(0..<steps.count, id: \.self) { i in
            VStack(spacing: 2) {
                Circle().fill(i <= currentStep ? Color.accentColor : Color.gray.opacity(0.3)).frame(width: 10, height: 10)
                    .overlay(i < currentStep ? Image(systemName: "checkmark").font(.system(size: 6)).foregroundColor(.white) : nil)
                Text(steps[i]).font(.system(size: 7)).lineLimit(1)
            }
            if i < steps.count - 1 { Rectangle().fill(i < currentStep ? Color.accentColor : Color.gray.opacity(0.3)).frame(height: 1).frame(maxWidth: 12) }
        } }
    }
}
