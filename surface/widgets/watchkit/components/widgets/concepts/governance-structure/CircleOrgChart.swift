import SwiftUI

// State machine: idle | circleSelected
enum CircleOrgChartWatchState {
    case idle
    case circleSelected
}

enum CircleOrgChartWatchEvent {
    case selectCircle(String)
    case deselect
    case expand(String)
    case collapse(String)
}

func circleOrgChartWatchReduce(_ state: CircleOrgChartWatchState, _ event: CircleOrgChartWatchEvent) -> CircleOrgChartWatchState {
    switch state {
    case .idle:
        if case .selectCircle = event { return .circleSelected }
        return state
    case .circleSelected:
        switch event {
        case .deselect: return .idle
        case .selectCircle: return .circleSelected
        default: return state
        }
    }
}

struct CircleMemberData: Identifiable {
    let id = UUID()
    let name: String
    let role: String
}

struct CircleData: Identifiable {
    let id: String
    let name: String
    let purpose: String
    var members: [CircleMemberData] = []
    var children: [CircleData] = []
}

struct CircleOrgChartWatchView: View {
    let circles: [CircleData]
    var onSelectCircle: ((String) -> Void)? = nil

    @State private var state: CircleOrgChartWatchState = .idle
    @State private var selectedCircleId: String? = nil
    @State private var expandedIds: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(circles) { circle in
                    circleRow(circle, depth: 0)
                }

                if let selId = selectedCircleId, let circle = findCircle(in: circles, id: selId) {
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(circle.name).font(.caption2).fontWeight(.bold)
                        Text(circle.purpose).font(.system(size: 9)).foregroundColor(.secondary)
                        if !circle.members.isEmpty {
                            Text("Members (\(circle.members.count))").font(.system(size: 8)).fontWeight(.semibold)
                            ForEach(circle.members) { member in
                                HStack {
                                    Text(member.name).font(.system(size: 8))
                                    Spacer()
                                    Text(member.role).font(.system(size: 7)).foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Organization chart")
    }

    @ViewBuilder
    private func circleRow(_ circle: CircleData, depth: Int) -> some View {
        let hasChildren = !circle.children.isEmpty
        let isExpanded = expandedIds.contains(circle.id)
        let isSelected = selectedCircleId == circle.id

        Button {
            if isSelected {
                selectedCircleId = nil
                state = circleOrgChartWatchReduce(state, .deselect)
            } else {
                selectedCircleId = circle.id
                state = circleOrgChartWatchReduce(state, .selectCircle(circle.id))
                onSelectCircle?(circle.id)
            }
        } label: {
            HStack(spacing: 3) {
                if hasChildren {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                        .onTapGesture {
                            if isExpanded { expandedIds.remove(circle.id) }
                            else { expandedIds.insert(circle.id) }
                        }
                } else {
                    Spacer().frame(width: 10)
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text(circle.name).font(.caption2).fontWeight(isSelected ? .bold : .regular)
                    Text("\(circle.members.count) members").font(.system(size: 7)).foregroundColor(.secondary)
                }
            }
            .padding(.leading, CGFloat(depth * 10))
            .padding(.vertical, 1)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(2)
        }
        .buttonStyle(.plain)

        if hasChildren && isExpanded {
            ForEach(circle.children) { child in
                circleRow(child, depth: depth + 1)
            }
        }
    }

    private func findCircle(in circles: [CircleData], id: String) -> CircleData? {
        for c in circles {
            if c.id == id { return c }
            if let found = findCircle(in: c.children, id: id) { return found }
        }
        return nil
    }
}
