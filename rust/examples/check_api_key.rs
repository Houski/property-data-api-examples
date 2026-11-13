//! Check that a Houski API key works.
//!
//! Calls /auth, which says whether the key exists and is enabled. It is free, so
//! it is the right first request to make with a new key.
//!
//! Usage: cargo run -r --example check_api_key

use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::env;

/// Send one GET request to the Houski API and return the parsed JSON answer.
fn houski<Answer: DeserializeOwned>(endpoint: &str, parameters: &[(&str, &str)]) -> Answer {
    let api_url = env::var("HOUSKI_API_URL").unwrap_or_else(|_| "https://api.houski.ca".to_string());
    let api_key = match env::var("HOUSKI_API_KEY") {
        Ok(api_key) => api_key,
        Err(_) => {
            eprintln!("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
            std::process::exit(1);
        }
    };
    let mut request = ureq::get(&format!("{api_url}/{endpoint}")).query("api_key", &api_key);
    for (name, value) in parameters {
        request = request.query(name, value);
    }
    match request.call() {
        Ok(response) => response.into_json().expect("the answer has the documented shape"),
        Err(ureq::Error::Status(code, response)) => {
            eprintln!("Houski answered {code}: {}", response.into_string().unwrap_or_default());
            std::process::exit(1);
        }
        Err(error) => {
            eprintln!("The request did not reach Houski: {error}");
            std::process::exit(1);
        }
    }
}

// /auth: the one answer with no cost, since it is never billed.
#[derive(Deserialize)]
struct AuthAnswer {
    api_key_authorized: bool,
    error: String,
    time_ms: u64,
}

fn main() {
    let answer: AuthAnswer = houski("auth", &[]);

    match answer.api_key_authorized {
        true => println!("The key works."),
        false => {
            eprintln!("The key was refused: {}", answer.error);
            std::process::exit(1);
        }
    }
}
