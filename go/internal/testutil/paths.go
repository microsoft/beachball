package testutil

import "runtime"

const DefaultBranch = "master"
const DefaultRemoteBranch = "origin/master"

// FakeRoot returns a fake root path appropriate for the current OS
// (e.g. "/fake-root" on Unix, `C:\fake-root` on Windows).
func FakeRoot() string {
	if runtime.GOOS == "windows" {
		return `C:\fake-root`
	}
	return "/fake-root"
}
