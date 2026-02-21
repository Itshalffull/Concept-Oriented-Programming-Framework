// Conduit Example App -- GTK Article List View
// Populates a GtkListBox with article rows, calling a callback on selection.

use gtk4::prelude::*;
use gtk4::{Box as GtkBox, Label, ListBox, ListBoxRow, Orientation};

use crate::api_client::Article;

pub fn build_article_list<F>(list_box: &ListBox, articles: &[Article], on_select: F)
where
    F: Fn(&Article) + Clone + 'static,
{
    let articles_clone: Vec<Article> = articles.to_vec();

    for article in articles {
        let row = ListBoxRow::new();
        let content = GtkBox::new(Orientation::Vertical, 4);
        content.set_margin_top(8);
        content.set_margin_bottom(8);
        content.set_margin_start(12);
        content.set_margin_end(12);

        let title_label = Label::builder()
            .label(&article.title)
            .css_classes(["heading"])
            .wrap(true)
            .xalign(0.0)
            .build();

        let desc_label = Label::builder()
            .label(&article.description)
            .css_classes(["caption"])
            .wrap(true)
            .xalign(0.0)
            .lines(2)
            .ellipsize(gtk4::pango::EllipsizeMode::End)
            .build();

        let meta_box = GtkBox::new(Orientation::Horizontal, 8);
        let author_label = Label::builder()
            .label(&article.author.username)
            .css_classes(["success"])
            .build();
        let fav_label = Label::builder()
            .label(&format!("\u{2665} {}", article.favorites_count))
            .css_classes(["dim-label"])
            .build();

        meta_box.append(&author_label);
        meta_box.append(&fav_label);

        content.append(&title_label);
        content.append(&desc_label);
        content.append(&meta_box);

        row.set_child(Some(&content));
        list_box.append(&row);
    }

    // Selection handler
    let callback = on_select;
    list_box.connect_row_selected(move |_, row| {
        if let Some(row) = row {
            let index = row.index() as usize;
            if index < articles_clone.len() {
                callback(&articles_clone[index]);
            }
        }
    });
}
