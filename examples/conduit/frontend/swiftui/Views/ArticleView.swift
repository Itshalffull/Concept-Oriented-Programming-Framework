// Conduit Example App -- SwiftUI Article Detail View
// Full article content with author info, comments, and social actions.

import SwiftUI

struct ArticleView: View {
    @EnvironmentObject var api: APIService
    let slug: String

    @State private var article: Article?
    @State private var comments: [Comment] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var newComment = ""
    @State private var isSubmitting = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading article...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                    Text(error)
                        .foregroundColor(.secondary)
                }
            } else if let article = article {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Header
                        VStack(alignment: .leading, spacing: 8) {
                            Text(article.title)
                                .font(.title)
                                .fontWeight(.bold)

                            HStack {
                                NavigationLink(destination: ProfileView(username: article.author.username)) {
                                    Text(article.author.username)
                                        .foregroundColor(Color(red: 0.36, green: 0.72, blue: 0.36))
                                }
                                Spacer()
                                Text(article.createdAt.prefix(10))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            HStack(spacing: 16) {
                                Button(action: toggleFollow) {
                                    Label(
                                        article.author.following ? "Unfollow" : "Follow",
                                        systemImage: article.author.following ? "person.badge.minus" : "person.badge.plus"
                                    )
                                    .font(.caption)
                                }
                                .buttonStyle(.bordered)

                                Button(action: toggleFavorite) {
                                    Label(
                                        "\(article.favoritesCount)",
                                        systemImage: article.favorited ? "heart.fill" : "heart"
                                    )
                                    .font(.caption)
                                }
                                .buttonStyle(.bordered)
                                .tint(article.favorited ? .red : .secondary)
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))

                        // Body
                        Text(article.body)
                            .font(.body)
                            .padding(.horizontal)

                        // Tags
                        if !article.tagList.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(article.tagList, id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption2)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color.gray.opacity(0.15))
                                            .cornerRadius(10)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }

                        Divider()

                        // Comments
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Comments")
                                .font(.title3)
                                .fontWeight(.bold)
                                .padding(.horizontal)

                            if api.isAuthenticated {
                                HStack {
                                    TextField("Write a comment...", text: $newComment)
                                        .textFieldStyle(.roundedBorder)
                                        .disabled(isSubmitting)
                                    Button(action: submitComment) {
                                        if isSubmitting {
                                            ProgressView()
                                        } else {
                                            Image(systemName: "paperplane.fill")
                                        }
                                    }
                                    .disabled(newComment.isEmpty || isSubmitting)
                                }
                                .padding(.horizontal)
                            }

                            ForEach(comments) { comment in
                                CommentRow(comment: comment, slug: slug, onDelete: {
                                    comments.removeAll { $0.id == comment.id }
                                })
                            }

                            if comments.isEmpty {
                                Text("No comments yet.")
                                    .foregroundColor(.secondary)
                                    .italic()
                                    .padding(.horizontal)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Article")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    private func loadData() async {
        do {
            errorMessage = nil
            async let articleReq = api.getArticle(slug: slug)
            async let commentsReq = api.getComments(slug: slug)
            article = try await articleReq
            comments = try await commentsReq
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func toggleFavorite() {
        guard let current = article else { return }
        Task {
            do {
                article = current.favorited
                    ? try await api.unfavorite(slug: slug)
                    : try await api.favorite(slug: slug)
            } catch { /* silently fail */ }
        }
    }

    private func toggleFollow() {
        guard let current = article else { return }
        Task {
            do {
                let profile = current.author.following
                    ? try await api.unfollow(username: current.author.username)
                    : try await api.follow(username: current.author.username)
                article?.author = profile
            } catch { /* silently fail */ }
        }
    }

    private func submitComment() {
        guard !newComment.isEmpty else { return }
        isSubmitting = true
        Task {
            do {
                let comment = try await api.createComment(slug: slug, body: newComment)
                comments.insert(comment, at: 0)
                newComment = ""
            } catch { /* silently fail */ }
            isSubmitting = false
        }
    }
}

struct CommentRow: View {
    @EnvironmentObject var api: APIService
    let comment: Comment
    let slug: String
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(comment.body)
                .font(.body)

            HStack {
                Text(comment.author.username)
                    .font(.caption)
                    .foregroundColor(Color(red: 0.36, green: 0.72, blue: 0.36))

                Text(comment.createdAt.prefix(10))
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                if api.currentUser?.username == comment.author.username {
                    Button(action: deleteComment) {
                        Image(systemName: "trash")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
        .padding(.horizontal)
    }

    private func deleteComment() {
        Task {
            do {
                try await api.deleteComment(slug: slug, commentId: comment.id)
                onDelete()
            } catch { /* silently fail */ }
        }
    }
}
