// Conduit Example App -- GTK Main Application Window
// GtkApplicationWindow with header bar, article list sidebar, and detail pane.

use gtk4::prelude::*;
use gtk4::{
    ApplicationWindow, Box as GtkBox, Button, HeaderBar, Label, ListBox, ListBoxRow,
    Orientation, Paned, ScrolledWindow, Separator, Stack,
};

use crate::api_client::{ApiClient, Article};
use crate::views::article_list::build_article_list;
use crate::views::login::show_login_dialog;

pub fn build_window(app: &gtk4::Application, api_client: ApiClient) -> ApplicationWindow {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Conduit")
        .default_width(1024)
        .default_height(640)
        .build();

    // Header bar
    let header = HeaderBar::new();

    let refresh_btn = Button::with_label("Refresh");
    let login_btn = Button::with_label("Sign In");
    header.pack_start(&refresh_btn);
    header.pack_end(&login_btn);

    window.set_titlebar(Some(&header));

    // Main paned layout
    let paned = Paned::new(Orientation::Horizontal);
    paned.set_position(350);

    // Left pane: article list
    let list_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .min_content_width(280)
        .build();

    let list_box = ListBox::new();
    list_box.set_selection_mode(gtk4::SelectionMode::Single);
    list_scroll.set_child(Some(&list_box));
    paned.set_start_child(Some(&list_scroll));

    // Right pane: article detail
    let detail_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .build();

    let detail_box = GtkBox::new(Orientation::Vertical, 12);
    detail_box.set_margin_top(16);
    detail_box.set_margin_bottom(16);
    detail_box.set_margin_start(16);
    detail_box.set_margin_end(16);

    let title_label = Label::builder()
        .label("Select an article to view it here.")
        .css_classes(["title-2"])
        .wrap(true)
        .xalign(0.0)
        .build();

    let author_label = Label::builder()
        .label("")
        .css_classes(["caption"])
        .xalign(0.0)
        .build();

    let body_label = Label::builder()
        .label("")
        .wrap(true)
        .xalign(0.0)
        .build();

    let tags_label = Label::builder()
        .label("")
        .css_classes(["caption"])
        .xalign(0.0)
        .build();

    detail_box.append(&title_label);
    detail_box.append(&author_label);
    detail_box.append(&Separator::new(Orientation::Horizontal));
    detail_box.append(&body_label);
    detail_box.append(&tags_label);

    detail_scroll.set_child(Some(&detail_box));
    paned.set_end_child(Some(&detail_scroll));

    window.set_child(Some(&paned));

    // Load articles
    let api = api_client.clone();
    let lb = list_box.clone();
    let tl = title_label.clone();
    let al = author_label.clone();
    let bl = body_label.clone();
    let tgl = tags_label.clone();

    let load_articles = move || {
        let api = api.clone();
        let lb = lb.clone();
        let tl = tl.clone();
        let al = al.clone();
        let bl = bl.clone();
        let tgl = tgl.clone();

        glib::spawn_future_local(async move {
            match api.get_articles().await {
                Ok(articles) => {
                    // Clear existing rows
                    while let Some(row) = lb.row_at_index(0) {
                        lb.remove(&row);
                    }

                    build_article_list(&lb, &articles, move |article: &Article| {
                        tl.set_label(&article.title);
                        al.set_label(&format!(
                            "By {} \u{00B7} {} \u{00B7} \u{2665} {}",
                            article.author.username,
                            &article.created_at[..10.min(article.created_at.len())],
                            article.favorites_count
                        ));
                        bl.set_label(&article.body);
                        let tag_text = if article.tag_list.is_empty() {
                            String::new()
                        } else {
                            format!("Tags: {}", article.tag_list.join(", "))
                        };
                        tgl.set_label(&tag_text);
                    });
                }
                Err(err) => {
                    let error_row = ListBoxRow::new();
                    let error_label = Label::new(Some(&format!("Error: {}", err)));
                    error_row.set_child(Some(&error_label));
                    lb.append(&error_row);
                }
            }
        });
    };

    // Initial load
    load_articles();

    // Refresh button
    let load_fn = load_articles.clone();
    refresh_btn.connect_clicked(move |_| {
        load_fn();
    });

    // Login button
    let win_ref = window.clone();
    let api_for_login = api_client.clone();
    login_btn.connect_clicked(move |btn| {
        let api = api_for_login.clone();
        let button = btn.clone();
        show_login_dialog(&win_ref, api, move |_user| {
            button.set_label("Signed In");
        });
    });

    window
}
