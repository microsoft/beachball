package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

var (
	Verbose = log.New(io.Discard, "", 0)
	Info    = log.New(os.Stdout, "", 0)
	Warn    = log.New(os.Stderr, "WARN: ", 0)
	Error   = log.New(os.Stderr, "ERROR: ", 0)
)

// SetOutput redirects all loggers to the given writer (for testing).
//
// Note: This mutates package-level globals, so it is NOT safe for use with t.Parallel().
// Tests within a package run sequentially by default, which is fine for now. If parallel
// test execution is needed in the future, switch to injecting a per-test writer (e.g. via
// context or a Loggers struct) instead of mutating shared state.
func SetOutput(w io.Writer, verboseEnabled bool) {
	Info.SetOutput(w)
	Warn.SetOutput(w)
	Error.SetOutput(w)

	if verboseEnabled {
		Verbose.SetOutput(w)
	} else {
		Verbose.SetOutput(io.Discard)
	}
}

func EnableVerbose() {
	Verbose.SetOutput(os.Stdout)
}

// Reset restores loggers to their default outputs, and verbose to no output.
func Reset() {
	Info.SetOutput(os.Stdout)
	Warn.SetOutput(os.Stderr)
	Error.SetOutput(os.Stderr)
	Verbose.SetOutput(io.Discard)
}

// Count returns "N thing" or "N things" with proper pluralization.
func Count(n int, thing string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, thing)
	}
	return fmt.Sprintf("%d %ss", n, thing)
}

// BulletedList formats a list of strings as a bulleted list.
func BulletedList(items []string) string {
	var sb strings.Builder
	for _, item := range items {
		fmt.Fprintf(&sb, " - %s\n", item)
	}
	return strings.TrimRight(sb.String(), "\n")
}
