// ============================================================
// Clef Surface SwiftUI Widget — FacetedSearch
//
// Search interface with multiple filter facets. Displays a
// search input alongside configurable facet groups.
// ============================================================

import SwiftUI

struct FacetGroup: Identifiable {
    let id: String
    let label: String
    var options: [FacetOption]
}

struct FacetOption: Identifiable {
    let id: String
    let label: String
    let value: String
    var count: Int = 0
}

struct FacetedSearchView: View {
    @Binding var query: String
    var facets: [FacetGroup]
    @Binding var selectedFacets: [String: Set<String>]
    var onSearch: ((String) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                TextField("Search...", text: $query)
                    .textFieldStyle(.plain)
                    .onSubmit { onSearch?(query) }
            }
            .padding(10)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            ForEach(facets) { facet in
                VStack(alignment: .leading, spacing: 4) {
                    Text(facet.label).font(.subheadline).fontWeight(.semibold)
                    ForEach(facet.options) { option in
                        let isSelected = selectedFacets[facet.id]?.contains(option.value) ?? false
                        SwiftUI.Button(action: {
                            var current = selectedFacets[facet.id] ?? []
                            if isSelected { current.remove(option.value) } else { current.insert(option.value) }
                            selectedFacets[facet.id] = current
                        }) {
                            HStack {
                                Image(systemName: isSelected ? "checkmark.square.fill" : "square").foregroundColor(.accentColor)
                                Text(option.label).font(.body).foregroundColor(.primary)
                                Spacer()
                                Text("\(option.count)").font(.caption).foregroundColor(.secondary)
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
