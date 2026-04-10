Tests in this folder are more like unit tests than true end-to-end tests (usually covering one helper function), but they must run against the actual filesystem and therefore must create temporary files for fixtures.

These tests are run before the E2E tests because a bug in one of these functions would likely cause many E2E tests to fail.
