# Porting TypeScript code to Go & Rust with Claude

_An experiment in AI-assisted cross-language code porting_

## Why do this experiment?

- Tools in TS/JS work fine at smaller scales, but are often slow in giant monorepos
- Recent efforts to write tools in Go or Rust have proven much faster
- Very few people on our teams know these languages--can AI help?

## Goals

Beachball was chosen due to its decent test coverage (though it isn't the highest priority to port)

**Questions to answer:**

- How well does Claude handle Go and Rust code generation? Any difference in quality?
- How do concepts and architecture translate across languages?
- Secondary for now: How does runtime performance compare?

(Slide notes: This idea started from a conversation about maybe porting Lage to native, and we've also discussed this for parts of Cloudpack, but beachball has better test coverage than lage and it was easier to pull out a couple smaller pieces. The disadvantage of this choice is beachball doesn't get into some of the scenarios like multithreading where a different language's capabilities would be especially interesting. Also one of its unique bottlenecks is git operations, and it's not clear how much native code would help there.)

## Scope

Included:

- `check` command (all related logic)
- `change` command (CLI options only, no prompts)
- CLI args (as relevant)
- JSON config files
- Config validation
- Runs on Linux/Mac or Windows

Skipped:

- `bump`, `publish`, `sync`
- Interactive prompts
- JS config files

## Implementation overview

| Layer                      | TypeScript                             | Go (`go/`)                                  | Rust (`rust/`)                       |
| -------------------------- | -------------------------------------- | ------------------------------------------- | ------------------------------------ |
| CLI                        | `yargs`                                | Cobra                                       | `clap`                               |
| Config                     | `.beachballrc.json` / `package.json`   | JSON decode                                 | serde_json                           |
| Git                        | `workspace-tools` (shell-out)          | shell-out to `git`                          | shell-out to `git`                   |
| Globs                      | `minimatch`                            | `bmatcuk/doublestar`                        | `globset`, `glob`                    |
| Logs (for user + can test) | `console.log/warn/error`, `jest.spyOn` | shared `log.Logger` vars; redirect for test | Custom macros to thread-local buffer |
| Test framework             | Jest                                   | `testing` (built-in) + `testify`            | built-in                             |
| Lint/format                | ESLint + Prettier                      | `go vet` + `gofmt`                          | `clippy` + `rustfmt`                 |

## How Claude did: the good

- Knows syntax, built-ins, and libraries for both languages
- Can explain unfamiliar syntax and concepts on request
  - No more trying to search for punctuation
- Can explain why it made each translation choice
- Considers trade-offs before adding libraries
- Once _very specifically instructed_, it can faithfully match existing tests and logic

## How Claude did: the meh

- **I don't know the language, so I can't evaluate its answers or output**
- Code review skills are helpful with AI too:
  - "This looks odd--why did you do it that way?"
  - "Is there a more idiomatic way?"
- Requires extra prompting to use newest language syntax/features
- Can be too reluctant to pull in libraries
  - Chose CLI arg libraries by default but required more prompting to use Go `testify` (assertions)
  - Seems to give decent answers when asked if there's a widely-used library + tradeoffs
- Doesn't prioritize concise/readable tests
- Sometimes doesn't know its own capabilities (skill syntax, LSP)

(Slide notes: Since I don't know the language, the output could be full of anti-patterns or just plain weird to someone who actually knows the language--potentially in ways that would require a more experienced reviewer to identify. I definitely also can't evaluate whether the code structure is idiomatic.)

## How Claude did: the bad (1)

```go
var sorted []string
for name := range existingPackages {
  sorted = append(sorted, name)
}
logging.Info.Printf("Found change files for these packages:\n%s",
  logging.BulletedList(sorted))
```

Classic AI problem: **plausible-looking output which is subtly incorrect**

## How Claude did: the bad (2)

**Instructions must be VERY specific that the TS logic, tests, and logs are authoritative** (do not add or omit anything)

- **Do this upfront** or you'll get plausible-looking code that doesn't do what you expect
  - It improved this on later direct comparison requests, but I'd still want to manually review in detail
  - Port in small chunks so it's possible to review in detail
- Must specify any libraries you want exactly copied (`workspace-tools`)
- Was worse about skipping or inventing things in Go

(Slide notes: I wasn't specific enough with my instructions at first, so I ended up having to make it do multiple retrospective passes "directly compare TS with Go/Rust--what's missing?")

## Language translation: What mapped well

- Module/package breakdown mirrored the TS `src/` layout almost 1:1
  - Not sure if this is idiomatic
- Mostly similar function breakdown
  - Again, not sure if idiomatic or how it scales
- Similar test file structure: one test file per source file
  - Go: next to code; Rust: separate tests folder

## Language translation: Challenges

- JS `null` vs set-to-`undefined` vs unset is hard to replicate
- Subtle differences in config object merging behavior
- Glob/pattern matching behavior differs across ecosystems
- Pass by value vs reference semantics vary (easy to forget; sometimes but not always handled reasonbly by Claude)

## Language translation: Go

- No optional properties — use pointers to distinguish unset from "zero values" (0, false, "")
- Error handling: explicit `if err != nil` return chains
- No built-in Set; maps are unordered
- JSON requires struct tags and custom marshal/unmarshal
- Package system created cycles that don't exist in TS
  - Claude initially "solved" with duplication
  - Resolved via function pointer injection (see `TestMain`)
- Claude quirks: more random omissions; forgot about generics until prompted

## Language translation: Rust

- VERY hard to read coming from TS
  - Claude is good at explaining things
- Not garbage collected (different way of thinking)
  - Ownership/borrowing: explicit `clone()`, `&` references
- Error handling: `Result<T,E>` return value + `?` operator
- `Option<T>` replaces nullable/optional fields — no null at all
- Pattern matching (`match`, `if let`) replaces conditionals and type narrowing
- Serde derive macros for JSON — more boilerplate but compile-time safe
- `cargo clippy` helps catch non-idiomatic generated code

## Performance comparison

**Hypothesis: native binaries should be faster in large repos**

_(Numbers not yet collected — benchmarks to be added)_

| Scenario                  | TS/Node | Go  | Rust |
| ------------------------- | ------- | --- | ---- |
| `check` — no changes      | TBD     | TBD | TBD  |
| `check` — large monorepo  | TBD     | TBD | TBD  |
| `change` - large monorepo | TBD     | TBD | TBD  |

## Pros of AI-assisted porting

- Claude knows syntax, built-ins, and standard libraries for unfamiliar languages
  - Much less fishing for syntax or accidentally reinventing the wheel
- Good at explaining language concepts and translating idioms (no searching for punctuation)
- Dramatically faster than learning a language from scratch and porting manually
- AI is also decent at generating slides for me to completely rewrite :)

## Summary / Conclusion

- Claude is a powerful accelerator but requires firm guardrails and careful review
  - Prompt engineering is critical to ensure test guardrails are precisely ported
  - Confidence increases with test coverage
- Need someone who knows the target language to validate overall quality
- Would I use this approach for real?
  - Probably, but carefully
  - Would be interesting to compare with having it rewrite from scratch given detailed E2E tests and a spec

## EXTRA: Tips

- In the instructions for tests, tell it to put the original TS test name as a comment, and add a comment listing any tests that couldn't be ported and why
- Could also be helpful to have it put corresponding TS function names in comments
