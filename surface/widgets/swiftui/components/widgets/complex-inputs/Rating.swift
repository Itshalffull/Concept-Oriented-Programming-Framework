// ============================================================
// Clef Surface SwiftUI Widget — Rating
//
// Star rating input allowing users to select a rating value.
// Renders a row of interactive star icons.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Rating view for star-based rating input.
///
/// - Parameters:
///   - value: Binding to the current rating value.
///   - maxRating: Maximum number of stars.
///   - enabled: Whether the rating is interactive.
///   - size: Size of star icons.
///   - onRatingChange: Callback when the rating changes.
struct RatingView: View {
    @Binding var value: Int
    var maxRating: Int = 5
    var enabled: Bool = true
    var size: CGFloat = 24
    var onRatingChange: ((Int) -> Void)? = nil

    var body: some View {
        HStack(spacing: 4) {
            ForEach(1...maxRating, id: \.self) { star in
                Image(systemName: star <= value ? "star.fill" : "star")
                    .font(.system(size: size))
                    .foregroundColor(star <= value ? .yellow : Color(.systemGray4))
                    .onTapGesture {
                        guard enabled else { return }
                        value = star
                        onRatingChange?(star)
                    }
                    .accessibilityLabel("\(star) star\(star == 1 ? "" : "s")")
                    .accessibilityAddTraits(star <= value ? .isSelected : [])
            }
        }
        .opacity(enabled ? 1.0 : 0.38)
        .accessibilityValue("\(value) of \(maxRating)")
    }
}
