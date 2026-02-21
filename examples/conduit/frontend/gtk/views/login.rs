// Conduit Example App -- GTK Login Dialog
// Modal dialog with email/password fields for authentication.

use gtk4::prelude::*;
use gtk4::{
    Box as GtkBox, Button, Dialog, Entry, Label, Orientation, ResponseType, Window,
};

use crate::api_client::{ApiClient, User};

pub fn show_login_dialog<F>(parent: &Window, api_client: ApiClient, on_success: F)
where
    F: Fn(User) + Clone + 'static,
{
    let dialog = Dialog::builder()
        .title("Sign In to Conduit")
        .transient_for(parent)
        .modal(true)
        .default_width(360)
        .default_height(220)
        .build();

    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("Sign In", ResponseType::Accept);

    let content = dialog.content_area();
    content.set_spacing(12);
    content.set_margin_top(16);
    content.set_margin_bottom(16);
    content.set_margin_start(16);
    content.set_margin_end(16);

    let email_label = Label::builder().label("Email").xalign(0.0).build();
    let email_entry = Entry::builder()
        .placeholder_text("you@example.com")
        .input_purpose(gtk4::InputPurpose::Email)
        .build();

    let password_label = Label::builder().label("Password").xalign(0.0).build();
    let password_entry = Entry::builder()
        .placeholder_text("Password")
        .visibility(false)
        .input_purpose(gtk4::InputPurpose::Password)
        .build();

    let error_label = Label::builder()
        .css_classes(["error"])
        .xalign(0.0)
        .visible(false)
        .build();

    content.append(&email_label);
    content.append(&email_entry);
    content.append(&password_label);
    content.append(&password_entry);
    content.append(&error_label);

    let email_ref = email_entry.clone();
    let password_ref = password_entry.clone();
    let error_ref = error_label.clone();
    let dialog_ref = dialog.clone();

    dialog.connect_response(move |dlg, response| {
        if response != ResponseType::Accept {
            dlg.close();
            return;
        }

        let email = email_ref.text().to_string();
        let password = password_ref.text().to_string();

        if email.is_empty() || password.is_empty() {
            error_ref.set_label("Email and password are required.");
            error_ref.set_visible(true);
            return;
        }

        let api = api_client.clone();
        let error_lbl = error_ref.clone();
        let dlg_close = dialog_ref.clone();
        let callback = on_success.clone();

        glib::spawn_future_local(async move {
            match api.login(&email, &password).await {
                Ok(user) => {
                    callback(user);
                    dlg_close.close();
                }
                Err(err) => {
                    error_lbl.set_label(&err);
                    error_lbl.set_visible(true);
                }
            }
        });
    });

    dialog.present();
}
