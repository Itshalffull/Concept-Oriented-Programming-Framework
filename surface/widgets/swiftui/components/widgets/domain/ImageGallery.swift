// ============================================================
// Clef Surface SwiftUI Widget — ImageGallery
//
// Thumbnail grid displayed as a LazyVGrid of image placeholders.
// Supports selection, optional captions, and a counter showing
// the current position.
// ============================================================

import SwiftUI

struct GalleryImage: Identifiable {
    var id: String { src }
    let src: String
    let alt: String
    var caption: String? = nil
}

struct ImageGalleryView: View {
    var images: [GalleryImage]
    var selectedIndex: Int = -1
    var columns: Int = 3
    var onSelect: (Int) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8) {
                ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                    let isSelected = index == selectedIndex

                    SwiftUI.Button(action: { onSelect(index) }) {
                        VStack(spacing: 4) {
                            // Image placeholder
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray5))
                                .aspectRatio(1, contentMode: .fit)
                                .overlay(
                                    Image(systemName: "photo")
                                        .font(.title)
                                        .foregroundColor(.secondary)
                                )

                            Text(image.alt)
                                .font(.caption)
                                .fontWeight(isSelected ? .bold : .regular)
                                .lineLimit(1)
                                .truncationMode(.tail)

                            if let caption = image.caption {
                                Text(caption)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                            }
                        }
                        .padding(8)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(.systemGray6))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 3)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(image.alt)
                    .accessibilityHint(image.caption ?? "")
                }
            }

            // Counter
            Text("\(selectedIndex >= 0 ? selectedIndex + 1 : 0) of \(images.count)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(8)
    }
}
