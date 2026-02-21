// Conduit Example App -- SwiftUI Profile View
// User profile with bio, follow/unfollow, and authored articles list.

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var api: APIService
    @Environment(\.dismiss) private var dismiss
    let username: String

    @State private var profile: Profile?
    @State private var articles: [Article] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var isOwnProfile: Bool {
        api.currentUser?.username == username
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading profile...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                    Text(error)
                        .foregroundColor(.secondary)
                }
            } else if let profile = profile {
                List {
                    // Profile header
                    Section {
                        VStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.36, green: 0.72, blue: 0.36))
                                    .frame(width: 80, height: 80)
                                Text(String(profile.username.prefix(1)).uppercased())
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                            }

                            Text(profile.username)
                                .font(.title2)
                                .fontWeight(.bold)

                            if let bio = profile.bio, !bio.isEmpty {
                                Text(bio)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                            }

                            if isOwnProfile {
                                Button(role: .destructive, action: logout) {
                                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                                }
                                .buttonStyle(.bordered)
                            } else {
                                Button(action: toggleFollow) {
                                    Label(
                                        profile.following ? "Unfollow" : "Follow",
                                        systemImage: profile.following ? "person.badge.minus" : "person.badge.plus"
                                    )
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical)
                    }

                    // Articles section
                    Section("Articles") {
                        if articles.isEmpty {
                            Text("No articles yet.")
                                .foregroundColor(.secondary)
                                .italic()
                        } else {
                            ForEach(articles) { article in
                                NavigationLink(destination: ArticleView(slug: article.slug)) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(article.title)
                                            .font(.headline)
                                            .lineLimit(2)
                                        Text(article.description)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .lineLimit(2)
                                    }
                                    .padding(.vertical, 2)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(username)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    private func loadData() async {
        do {
            errorMessage = nil
            async let profileReq = api.getProfile(username: username)
            async let articlesReq = api.getArticles()
            let fetchedProfile = try await profileReq
            let allArticles = try await articlesReq
            profile = fetchedProfile
            articles = allArticles.filter { $0.author.username == username }
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func toggleFollow() {
        guard let current = profile else { return }
        Task {
            do {
                profile = current.following
                    ? try await api.unfollow(username: username)
                    : try await api.follow(username: username)
            } catch { /* silently fail */ }
        }
    }

    private func logout() {
        api.logout()
        dismiss()
    }
}
