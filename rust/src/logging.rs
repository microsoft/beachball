// User-facing logging with test capture support.
//
// All CLI output goes through log_info!/log_warn!/log_error! macros instead of
// println!/eprintln! directly. This allows tests to capture and assert on output
// (matching the TS tests' jest.spyOn(console, ...) pattern).
//
// We use thread-local storage rather than a global Mutex so that Rust's parallel
// test runner works correctly — each test thread gets its own independent capture
// buffer with no cross-test interference.
//
// We don't use the `log` crate because this is user-facing CLI output (not
// diagnostic logging), and env_logger would add unwanted formatting (timestamps,
// module paths, etc.).

use std::cell::RefCell;
use std::io::Write;

thread_local! {
    // When Some, output is captured into the buffer. When None, output goes to stdout/stderr.
    static LOG_CAPTURE: RefCell<Option<Vec<u8>>> = const { RefCell::new(None) };
}

/// Start capturing log output on the current thread.
pub fn set_output() {
    LOG_CAPTURE.with(|c| *c.borrow_mut() = Some(Vec::new()));
}

/// Stop capturing and restore default stdout/stderr output.
pub fn reset() {
    LOG_CAPTURE.with(|c| *c.borrow_mut() = None);
}

/// Get captured log output as a string.
pub fn get_output() -> String {
    LOG_CAPTURE.with(|c| {
        let borrow = c.borrow();
        match &*borrow {
            Some(buf) => String::from_utf8_lossy(buf).to_string(),
            None => String::new(),
        }
    })
}

pub enum Level {
    Info,
    Warn,
    Error,
}

pub fn write_log(level: Level, msg: &str) {
    LOG_CAPTURE.with(|c| {
        let mut borrow = c.borrow_mut();
        if let Some(ref mut buf) = *borrow {
            match level {
                Level::Info => writeln!(buf, "{msg}").ok(),
                Level::Warn => writeln!(buf, "WARN: {msg}").ok(),
                Level::Error => writeln!(buf, "ERROR: {msg}").ok(),
            };
            return;
        }
        drop(borrow);
        match level {
            Level::Info => println!("{msg}"),
            Level::Warn => eprintln!("WARN: {msg}"),
            Level::Error => eprintln!("ERROR: {msg}"),
        }
    });
}

#[macro_export]
macro_rules! log_info {
    () => {
        $crate::logging::write_log($crate::logging::Level::Info, "")
    };
    ($($arg:tt)*) => {
        $crate::logging::write_log($crate::logging::Level::Info, &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::logging::write_log($crate::logging::Level::Warn, &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::logging::write_log($crate::logging::Level::Error, &format!($($arg)*))
    };
}

/// Format items as a bulleted list.
pub fn bulleted_list(items: &[&str]) -> String {
    items
        .iter()
        .map(|item| format!("  • {item}"))
        .collect::<Vec<_>>()
        .join("\n")
}
