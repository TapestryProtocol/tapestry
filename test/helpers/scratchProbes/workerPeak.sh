#!/bin/sh
# A probe copied INTO a scratch container and run there (graph-operations-foundation #9, AC4): waits for a lifecycle
# job's worker (node …/lifecycle/_worker.js <runId>) to start, samples its peak resident memory (VmHWM) every 200 ms
# until it exits, and prints one line:
#   peakKB=<n> afterBackupKB=<n|none> pid=<pid> run=<runId>
# afterBackupKB is the peak when the run's file first shows a stage past `backup` (the job writes `planning` again
# after its backup, just before the check: _jobs.js runMigrateJob), so it is the peak the job's own backup left. It is
# `none` for a job that took no backup. "peakKB=none" means no worker started in time.
#
#   docker exec -d <scratch> sh -c 'sh /tmp/workerPeak.sh 900 > /tmp/workerPeak.out 2>&1'
deadline=$(( $(date +%s) + ${1:-900} ))
pid=""
while [ -z "$pid" ] && [ "$(date +%s)" -lt "$deadline" ]; do pid=$(pgrep -f 'lifecycle/_worker.js' | head -1); sleep 0.2; done
[ -z "$pid" ] && { echo "peakKB=none afterBackupKB=none"; exit 0; }
run=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null | awk '{print $NF}')
runfile="${TAPESTRY_BACKUPS_DIR:-/var/lib/brainstorm/backups}/.runs/$run.json"
peak=0
seen_backup=0
after_backup=""
while kill -0 "$pid" 2>/dev/null; do
  v=$(sed -n 's/^VmHWM:[[:space:]]*\([0-9]*\) kB/\1/p' /proc/$pid/status 2>/dev/null)
  [ -n "$v" ] && [ "$v" -gt "$peak" ] && peak=$v
  stage=$(sed -n 's/.*"stage":[[:space:]]*"\([a-z-]*\)".*/\1/p' "$runfile" 2>/dev/null | head -1)
  [ "$stage" = backup ] && seen_backup=1
  if [ "$seen_backup" = 1 ] && [ -z "$after_backup" ] && [ -n "$stage" ] && [ "$stage" != backup ]; then after_backup=$peak; fi
  sleep 0.2
done
echo "peakKB=$peak afterBackupKB=${after_backup:-none} pid=$pid run=$run"
