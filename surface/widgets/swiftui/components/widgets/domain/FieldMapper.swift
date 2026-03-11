// ============================================================
// Clef Surface SwiftUI Widget — FieldMapper
//
// Field mapping interface rendered as two columns (source and
// target) with connection indicators between mapped pairs.
// Supports adding new mappings and removing existing ones.
// ============================================================

import SwiftUI

struct FieldMapping: Identifiable {
    var id: String { "\(source)->\(target)" }
    let source: String
    let target: String
}

struct FieldMapperView: View {
    var sourceFields: [String]
    var targetFields: [String]
    var mappings: [FieldMapping]
    var selectedIndex: Int = -1
    var onSelectMapping: (Int) -> Void = { _ in }
    var onMap: (String, String) -> Void = { _, _ in }
    var onUnmap: (String, String) -> Void = { _, _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("Source")
                    .font(.caption)
                    .fontWeight(.bold)
                    .underline()
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer().frame(width: 32)

                Text("Target")
                    .font(.caption)
                    .fontWeight(.bold)
                    .underline()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Mapped pairs
            ForEach(Array(mappings.enumerated()), id: \.element.id) { index, mapping in
                let isSelected = index == selectedIndex

                SwiftUI.Button(action: { onSelectMapping(index) }) {
                    HStack(spacing: 8) {
                        Text(mapping.source)
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        Text("\u{2192}")
                            .fontWeight(.bold)
                            .foregroundColor(.accentColor)

                        Text(mapping.target)
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        SwiftUI.Button(action: { onUnmap(mapping.source, mapping.target) }) {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }

            // Unmapped fields
            let mappedSources = Set(mappings.map { $0.source })
            let unmapped = sourceFields.filter { !mappedSources.contains($0) }
            if !unmapped.isEmpty {
                Text("Unmapped: \(unmapped.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Add mapping button
            SwiftUI.Button(action: {
                let mappedTargets = Set(mappings.map { $0.target })
                if let unmappedSource = sourceFields.first(where: { !mappedSources.contains($0) }),
                   let unmappedTarget = targetFields.first(where: { !mappedTargets.contains($0) }) {
                    onMap(unmappedSource, unmappedTarget)
                }
            }) {
                HStack {
                    Image(systemName: "plus")
                    Text("Map")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding(8)
    }
}
