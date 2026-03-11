// ============================================================
// Clef Surface SwiftUI Widget — RangeSlider
//
// Dual-thumb slider for selecting a value range. Shows min
// and max handles on a single track.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// RangeSlider view for selecting a value range.
///
/// - Parameters:
///   - low: Binding to the lower bound value.
///   - high: Binding to the upper bound value.
///   - min: Minimum value.
///   - max: Maximum value.
///   - label: Optional label text.
///   - enabled: Whether the slider is enabled.
struct RangeSliderView: View {
    @Binding var low: Double
    @Binding var high: Double
    var min: Double = 0
    var max: Double = 100
    var label: String? = nil
    var enabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            GeometryReader { geometry in
                let range = max - min
                let width = geometry.size.width - 24

                ZStack(alignment: .leading) {
                    // Track background
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(.systemGray5))
                        .frame(height: 4)

                    // Selected range
                    let lowOffset = range > 0 ? CGFloat((low - min) / range) * width : 0
                    let highOffset = range > 0 ? CGFloat((high - min) / range) * width : width
                    RoundedRectangle(cornerRadius: 2)
                        .fill(enabled ? Color.accentColor : Color.gray)
                        .frame(width: highOffset - lowOffset, height: 4)
                        .offset(x: lowOffset + 12)

                    // Low thumb
                    Circle()
                        .fill(enabled ? Color.accentColor : Color.gray)
                        .frame(width: 24, height: 24)
                        .offset(x: lowOffset)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    guard enabled else { return }
                                    let newValue = min + Double(value.location.x / width) * range
                                    low = Swift.min(Swift.max(newValue, min), high)
                                }
                        )

                    // High thumb
                    Circle()
                        .fill(enabled ? Color.accentColor : Color.gray)
                        .frame(width: 24, height: 24)
                        .offset(x: highOffset)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    guard enabled else { return }
                                    let newValue = min + Double(value.location.x / width) * range
                                    high = Swift.max(Swift.min(newValue, max), low)
                                }
                        )
                }
            }
            .frame(height: 24)

            HStack {
                Text("\(Int(low))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(Int(high))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .accessibilityLabel(label ?? "Range slider")
        .accessibilityValue("From \(Int(low)) to \(Int(high))")
    }
}
