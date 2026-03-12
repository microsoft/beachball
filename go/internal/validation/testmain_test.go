package validation_test

// TestMain wires up testutil.WriteChangeFilesFn with the real changefile.WriteChangeFiles
// implementation, breaking the import cycle between testutil and changefile.
// This runs before any tests in this package.

import (
	"os"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/testutil"
)

func TestMain(m *testing.M) {
	testutil.WriteChangeFilesFn = changefile.WriteChangeFiles
	os.Exit(m.Run())
}
