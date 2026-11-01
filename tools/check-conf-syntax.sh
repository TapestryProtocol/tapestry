#!/bin/bash
# Check that a config file bash will `source` parses, without ever printing its contents.
# ADR security-auth-exposure/0006 (story security-auth-exposure #11).
#
# Usage:  tools/check-conf-syntax.sh <conf-file>
# Exit 0, silent, when `bash -n` accepts the file. Exit 1 otherwise, with one line on stderr naming the line number.
#
# `bash -n` writes its complaint to stderr, and for some errors that complaint includes the offending line itself,
# secret value and all. So its output is captured into a variable here and never printed: only the line number is
# pulled out of it (LC_ALL=C keeps bash's wording English, so the number can be found). Bash reports an unclosed
# quote at the file's last line, not the line that opened it.

conf="$1"
if [ -z "$conf" ] || [ ! -r "$conf" ]; then
  echo "[check-conf-syntax] no readable config file given (${conf:-none})" >&2
  exit 1
fi

if out=$(LC_ALL=C bash -n "$conf" 2>&1 >/dev/null); then
  exit 0
fi

line=$(printf '%s\n' "$out" | grep -oE 'line [0-9]+' | head -n 1 | grep -oE '[0-9]+')
if [ -n "$line" ]; then
  echo "[check-conf-syntax] $conf is not valid bash near line $line (an unclosed quote is reported at the last line); not printing the line, since it may hold a secret" >&2
else
  echo "[check-conf-syntax] $conf is not valid bash; not printing bash's message, since it may hold a secret" >&2
fi
exit 1
