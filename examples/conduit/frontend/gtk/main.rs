// Conduit Example App -- GTK4 Rust Application Entry Point
// Initializes the GTK application and shows the main window.

mod api_client;
mod views;
mod window;

use gtk4::prelude::*;
use gtk4::Application;

use api_client::ApiClient;
use window::build_window;

const APP_ID: &str = "com.clef.conduit.gtk";

fn main() {
    let app = Application::builder().application_id(APP_ID).build();

    app.connect_activate(|app| {
        let api_client = ApiClient::new();
        let window = build_window(app, api_client);
        window.present();
    });

    app.run();
}
