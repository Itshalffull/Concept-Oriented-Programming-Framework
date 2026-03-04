// ============================================================
// Clef Surface SwiftUI Widget — Card
//
// Surface container grouping related content with header, body,
// and optional footer. Supports outline, elevated, and filled
// variants.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum CardVariant { case outline, elevated, filled }
enum CardSize {
    case sm, md, lg

    var padding: CGFloat {
        switch self {
        case .sm: return 8
        case .md: return 16
        case .lg: return 24
        }
    }
}

// --------------- Component ---------------

/// Card view grouping related content.
///
/// - Parameters:
///   - title: Primary heading text.
///   - description: Optional secondary text.
///   - variant: Card variant controlling visual presentation.
///   - size: Size controlling internal padding.
///   - content: Content rendered inside the card body.
struct CardView<Content: View>: View {
    var title: String? = nil
    var description: String? = nil
    var variant: CardVariant = .outline
    var size: CardSize = .md
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title = title {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)

                if let description = description {
                    Text(description)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }

                Spacer().frame(height: 12)
            }

            content
        }
        .padding(size.padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(borderColor, lineWidth: variant == .outline ? 1 : 0)
        )
        .shadow(radius: variant == .elevated ? 4 : 0)
    }

    private var backgroundColor: Color {
        switch variant {
        case .outline: return Color(.systemBackground)
        case .elevated: return Color(.systemBackground)
        case .filled: return Color(.systemGray6)
        }
    }

    private var borderColor: Color {
        variant == .outline ? Color(.systemGray4) : .clear
    }
}
