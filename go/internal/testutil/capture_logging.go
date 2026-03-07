package testutil

import (
	"bytes"
	"testing"

	"github.com/microsoft/beachball/internal/logging"
)

// CaptureLogging redirects all loggers to a buffer for the duration of the test.
func CaptureLogging(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	logging.SetOutput(&buf)
	t.Cleanup(logging.Reset)
	return &buf
}
