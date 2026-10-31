# Test Plan: Story 9 — The config reader logs key names, never values

**Story:** `engineering-team/stories/security-auth-exposure/9-config-reader-logs-no-values.md`
**ADR:** none (Bug, Standard: Architecture skipped as obvious)
**Book:** `engineering-team/audits/config-secret-logging/book.md`
**Date:** 2026-10-31

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1, AC-4 | `AC-1 a quoted value is returned and never logged; the log names the key and says quoted` | `test/config-secret-logging.test.js` | unit |
| AC-1, AC-4 | `AC-1 an unquoted value is returned and never logged; the log names the key and says unquoted` | `test/config-secret-logging.test.js` | unit |
| AC-2, AC-4 | `AC-2 a value only the source fallback finds (environment only) is returned and never logged` | `test/config-secret-logging.test.js` | unit |
| AC-3, AC-4 | `AC-3 a default is returned and never logged when nothing resolves the key` | `test/config-secret-logging.test.js` | unit |
| AC-3, AC-4 | `AC-3/AC-4 with no config file the default is returned and never logged; the log says the file is missing` | `test/config-secret-logging.test.js` | unit |
| AC-5 | startup log of a scratch instance, then of the staging droplet | manual, evidence in the review | live |

## Edge cases

- [x] **The `source` fallback finds a value only in the environment.** Its bash shell inherits the process
      environment, so a secret set only as an environment variable resolves there; covered by the AC-2 test.
- [x] **No config file at all.** The default is still returned and still not logged; covered by the last test.
- [x] **Every return value is unchanged.** Each test asserts the returned value first, so a fix that silences the log
      by breaking the lookup fails.

## Test infrastructure

- Stack-free. `getConfigFromFile()` reads the file `BRAINSTORM_CONF_PATH` names, so `run()` writes a temp config file,
  points the variable at it, sets one environment-only key and restores everything when it ends.
- The capture replaces `process.stdout.write` and `process.stderr.write` during each call only, so it catches every
  console method and any direct write, and the suite's own output is untouched.
- Values are random per run (`crypto.randomBytes`), so a match can only come from a leak.
- No network, no stack, no publishing. Registered in `test/registry.js` after story 8's suites.

## How to run

Run this suite alone (a full `npm test` on the Mac Studio publishes fixtures; see AGENTS.md):

```
node test/config-secret-logging.test.js
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-31 on `fix/config-secret-logging`, parent `0a60c80f`:

```
  ✗ AC-1 a quoted value is returned and never logged; the log names the key and says quoted
      quoted: the log holds the value ("Reading config for CSL_TEST_QUOTED_SECRET from …/brainstorm.conf\nFound CSL_TEST_QUOTED_SECRET=quoted-b08f8c12… (quoted)")
  ✗ AC-1 an unquoted value is returned and never logged; the log names the key and says unquoted
      unquoted: the log holds the value ("… Found CSL_TEST_UNQUOTED_SECRET=unquoted-bff055bf… (unquoted)")
  ✗ AC-2 a value only the source fallback finds (environment only) is returned and never logged
      source fallback: the log holds the value ("… Source command result for CSL_TEST_ENV_ONLY_SECRET: 'envonly-55b992d9…'")
  ✗ AC-3 a default is returned and never logged when nothing resolves the key
      default: the log holds the value ("… Using default value for CSL_TEST_MISSING_SECRET: default-78aefe8a…")
  ✗ AC-3/AC-4 with no config file the default is returned and never logged; the log says the file is missing
      no config file: the log holds the value ("Config file …/does-not-exist.conf not found\nUsing default value for CSL_TEST_QUOTED_SECRET: default-78aefe8a…")

config-secret-logging: 0 passed, 5 failed
```

Every failure is the "value not logged" assertion; the returned values and the AC-4 name-and-resolution assertions
already hold. `test/stack-free-npm-test.test.js` (the registry guard) passes 7/7 with the new suite registered.
