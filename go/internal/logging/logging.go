package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

var (
	Info  = log.New(os.Stdout, "", 0)
	Warn  = log.New(os.Stderr, "WARN: ", 0)
	Error = log.New(os.Stderr, "ERROR: ", 0)
)

// SetOutput redirects all loggers to the given writer (for testing).
func SetOutput(w io.Writer) {
	Info.SetOutput(w)
	Warn.SetOutput(w)
	Error.SetOutput(w)
}

// Reset restores loggers to their default outputs.
func Reset() {
	Info.SetOutput(os.Stdout)
	Warn.SetOutput(os.Stderr)
	Error.SetOutput(os.Stderr)
}

// BulletedList formats a list of strings as a bulleted list.
func BulletedList(items []string) string {
	var sb strings.Builder
	for _, item := range items {
		fmt.Fprintf(&sb, " - %s\n", item)
	}
	return strings.TrimRight(sb.String(), "\n")
}
