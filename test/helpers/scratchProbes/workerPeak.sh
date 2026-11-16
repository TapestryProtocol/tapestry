#!/bin/sh
# A probe copied INTO a scratch container and run there (graph-operations-foundation #9, AC4): waits for a lifecycle
# job's worker (node …/lifecycle/_worker.js <runId>) to start, samples its peak resident memory (VmHWM) every 200 ms
# until it exits, and prints one line: "peakKB=<n> pid=<pid>", or "peakKB=none" when no worker started in time.
#
#   docker exec -d <scratch> sh -c '/tmp/workerPeak.sh 900 > /tmp/workerPeak.out 2>&1'
deadline=$(( $(date +%s) + ${1:-900} ))
pid=""
while [ -z "$pid" ] && [ "$(date +%s)" -lt "$deadline" ]; do pid=$(pgrep -f 'lifecycle/_worker.js' | head -1); sleep 0.2; done
[ -z "$pid" ] && { echo "peakKB=none"; exit 0; }
peak=0
while kill -0 "$pid" 2>/dev/null; do
  v=$(sed -n 's/^VmHWM:[[:space:]]*\([0-9]*\) kB/\1/p' /proc/$pid/status 2>/dev/null)
  [ -n "$v" ] && [ "$v" -gt "$peak" ] && peak=$v
  sleep 0.2
done
echo "peakKB=$peak pid=$pid"
