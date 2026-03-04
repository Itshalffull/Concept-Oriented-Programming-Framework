// ============================================================
// Clef Surface WatchKit Widget - FacetedSearch
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FacetedSearchView: View {
    @Binding var query: String; var facets: [(label: String, active: Bool)] = []
    var body: some View {
        VStack(spacing: 4) { TextField("Search...", text: $query).font(.caption2)
            ScrollView(.horizontal) { HStack(spacing: 4) { ForEach(0..<facets.count, id: \.self) { i in
                Text(facets[i].label).font(.caption2).padding(.horizontal, 6).padding(.vertical, 2)
                    .background(facets[i].active ? Color.accentColor.opacity(0.3) : Color.gray.opacity(0.2)).cornerRadius(6)
            } } }
        }
    }
}
