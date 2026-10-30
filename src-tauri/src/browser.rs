//! Built-in browser: a window with pathofexile.com where the user logs in and passes the
//! Cloudflare check. APT sends its trade requests through Electron's network stack with the
//! browser's session cookies (`proxy.ts`, `useSessionCookies`). Here the HTTP client (reqwest)
//! has its own cookies and a different TLS fingerprint, which Cloudflare's clearance cookie is
//! tied to, so copying cookies is not enough (FINDINGS F-45). Instead trade requests run as
//! `fetch` inside this page itself: same origin, the browser's cookies, User-Agent and TLS.
//! The page keeps the result in a global; we collect it with `eval_with_callback`, which needs
//! no Tauri IPC permission for the remote site.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::Instant;

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::platform;
use crate::state::AppState;

use crate::constants::{
    BROWSER_HEIGHT_LOGICAL, BROWSER_HOME_PATH, BROWSER_HOSTS, BROWSER_LOAD_TIMEOUT,
    BROWSER_LOG_URL_CHARS, BROWSER_POLL_DELAY, BROWSER_REPLIES_GLOBAL, BROWSER_REQUEST_TIMEOUT,
    BROWSER_TITLE, BROWSER_WIDTH_LOGICAL, BROWSER_WINDOW as LABEL,
};

#[derive(serde::Deserialize)]
pub struct BrowserRequest {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct BrowserResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

/// What the page leaves in its replies global for a request.
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum PageResult {
    Ok(BrowserResponse),
    Err { error: String },
}

static LOADED: AtomicBool = AtomicBool::new(false);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// The trade page on `host` (one of `GameProfile::trade_hosts`).
fn home(host: &str) -> Result<tauri::Url, String> {
    format!("https://{host}{BROWSER_HOME_PATH}")
        .parse()
        .map_err(|e| format!("{e}"))
}

/// Host of the page the browser shows now.
fn page_host(window: &WebviewWindow) -> Option<String> {
    window.url().ok()?.host_str().map(str::to_string)
}

fn window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        return Ok(window);
    }
    let state = app.state::<AppState>();
    let url = home(&state.trade_host())?;
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url))
        .title(BROWSER_TITLE)
        .inner_size(BROWSER_WIDTH_LOGICAL, BROWSER_HEIGHT_LOGICAL)
        .visible(false)
        .on_page_load(|_, payload| {
            LOADED.store(payload.event() == PageLoadEvent::Finished, Ordering::SeqCst);
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(window)
}

/// The request as a script for the page; the result lands in `window[global][id]`.
fn fetch_script(id: u64, request: &BrowserRequest, host: &str) -> String {
    format!(
        r#"(() => {{
  const replies = (window[{global}] ??= {{}});
  const done = (reply) => {{ replies[{id}] = reply; }};
  (async () => {{
    if (location.hostname !== {host}) throw new Error('the built-in browser is not on ' + {host});
    const response = await fetch({url}, {{ method: {method}, headers: {headers}, body: {body}, credentials: 'include' }});
    done({{ status: response.status, headers: [...response.headers], body: await response.text() }});
  }})().catch((e) => done({{ error: String((e && e.message) || e) }}));
  return true;
}})()"#,
        global = json(BROWSER_REPLIES_GLOBAL),
        host = json(host),
        url = json(&request.url),
        method = json(&request.method),
        headers = json(&request.headers),
        body = json(&request.body),
    )
}

/// Takes the result for `id` out of the page, as JSON text, or `null` while it is not there yet.
fn collect_script(id: u64) -> String {
    format!(
        "(() => {{ const r = window[{global}]; if (!r || !({id} in r)) return null; const v = r[{id}]; delete r[{id}]; return JSON.stringify(v); }})()",
        global = json(BROWSER_REPLIES_GLOBAL),
    )
}

/// `eval_with_callback` hands over the script's value as JSON: here a JSON string with our JSON, or null.
fn parse_collected(value: &str) -> Option<Result<PageResult, String>> {
    let text: Option<String> = serde_json::from_str(value).ok()?;
    let text = text?;
    Some(serde_json::from_str(&text).map_err(|e| format!("bad reply from the browser: {e}")))
}

fn eval_value(window: &WebviewWindow, script: String) -> Result<String, String> {
    let (sender, receiver) = mpsc::channel();
    window
        .eval_with_callback(script, move |value| {
            let _ = sender.send(value);
        })
        .map_err(|e| e.to_string())?;
    receiver
        .recv_timeout(BROWSER_REQUEST_TIMEOUT)
        .map_err(|_| "the built-in browser did not run the script".to_string())
}

fn json<T: serde::Serialize + ?Sized>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".into())
}

/// Runs `request` inside the browser page. Blocks: call from a worker thread.
pub fn fetch(app: &AppHandle, request: BrowserRequest) -> Result<BrowserResponse, String> {
    let hosts = BROWSER_HOSTS;
    let host = tauri::Url::parse(&request.url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .filter(|host| hosts.contains(&host.as_str()))
        .ok_or("the built-in browser makes requests only for pathofexile.com")?;
    let window = window(app)?;
    // The request goes out from a page on its own host (cookies, Cloudflare clearance).
    if page_host(&window).as_deref() != Some(host.as_str()) {
        LOADED.store(false, Ordering::SeqCst);
        window.navigate(home(&host)?).map_err(|e| e.to_string())?;
    }
    let started = Instant::now();
    while !LOADED.load(Ordering::SeqCst) {
        if started.elapsed() > BROWSER_LOAD_TIMEOUT {
            return Err("pathofexile.com did not load in the built-in browser".into());
        }
        std::thread::sleep(BROWSER_POLL_DELAY);
    }

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    if eval_value(&window, fetch_script(id, &request, &host))? != "true" {
        return Err("the built-in browser did not start the request".into());
    }
    while started.elapsed() < BROWSER_REQUEST_TIMEOUT {
        std::thread::sleep(BROWSER_POLL_DELAY);
        match parse_collected(&eval_value(&window, collect_script(id))?) {
            None => continue,
            Some(Ok(PageResult::Ok(response))) => {
                let path = request.url.split('?').next().unwrap_or_default();
                let path: String = path.chars().take(BROWSER_LOG_URL_CHARS).collect();
                log::info!("[browser] {} {path} -> {}", request.method, response.status);
                return Ok(response);
            }
            Some(Ok(PageResult::Err { error })) => return Err(error),
            Some(Err(e)) => return Err(e),
        }
    }
    Err("the built-in browser did not answer in time".into())
}

/// Window handle of the browser, once it exists.
pub fn hwnd(app: &AppHandle) -> Option<platform::RawHwnd> {
    let window = app.get_webview_window(LABEL)?;
    Some(window.hwnd().ok()?.0 as platform::RawHwnd)
}

/// The browser hotkey: show the browser, or, when it is in front, hide it and go back to the game.
pub fn toggle(app: &AppHandle, game: Option<platform::RawHwnd>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
            if let Some(game) = game {
                platform::focus(game);
            }
            return Ok(());
        }
    }
    open(app, None)
}

/// Shows the browser, on `url` if given (otherwise where it is).
pub fn open(app: &AppHandle, url: Option<&str>) -> Result<(), String> {
    let window = window(app)?;
    if let Some(url) = url {
        let url = url.parse().map_err(|e| format!("{e}"))?;
        window.navigate(url).map_err(|e| e.to_string())?;
    } else {
        // The game language changed since: go to its trade site.
        let host = app.state::<AppState>().trade_host();
        if page_host(&window).as_deref() != Some(host.as_str()) {
            window.navigate(home(&host)?).map_err(|e| e.to_string())?;
        }
    }
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_embeds_the_request_as_json() {
        let script = fetch_script(
            7,
            &BrowserRequest {
                url: "https://www.pathofexile.com/api/trade2/search/Standard".into(),
                method: "POST".into(),
                headers: vec![("Content-Type".into(), "application/json".into())],
                body: Some(r#"{"query":"it's \"quoted\""}"#.into()),
            },
            "www.pathofexile.com",
        );
        assert!(script.contains("replies[7] = reply"));
        assert!(
            script.contains(r#"fetch("https://www.pathofexile.com/api/trade2/search/Standard""#)
        );
        assert!(script.contains(r#"headers: [["Content-Type","application/json"]]"#));
        assert!(script.contains(r#"body: "{\"query\":\"it's \\\"quoted\\\"\"}""#));
    }

    #[test]
    fn collected_replies_are_parsed() {
        assert!(parse_collected("null").is_none());
        let reply =
            r#""{\"status\":200,\"headers\":[[\"x-rate-limit-rules\",\"Ip\"]],\"body\":\"{}\"}""#;
        match parse_collected(reply) {
            Some(Ok(PageResult::Ok(response))) => {
                assert_eq!(response.status, 200);
                assert_eq!(response.headers[0].1, "Ip");
            }
            _ => panic!("not parsed"),
        }
        assert!(matches!(
            parse_collected(r#""{\"error\":\"Failed to fetch\"}""#),
            Some(Ok(PageResult::Err { .. }))
        ));
    }
}
