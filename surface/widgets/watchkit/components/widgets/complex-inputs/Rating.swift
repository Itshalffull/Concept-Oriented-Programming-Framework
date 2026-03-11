// ============================================================
// Clef Surface WatchKit Widget — Rating
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct RatingView: View {
    @Binding var rating: Int; var maxRating: Int = 5
    var body: some View { HStack(spacing: 2) { ForEach(1...maxRating, id: \.self) { i in
        Image(systemName: i <= rating ? "star.fill" : "star").font(.caption).foregroundColor(.yellow).onTapGesture { rating = i }
    } } }
}
