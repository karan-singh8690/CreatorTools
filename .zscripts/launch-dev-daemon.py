#!/usr/bin/env python3
"""Double-fork daemon launcher for the Next.js dev server.
The grandchild becomes a true orphan (parent = PID 1), which may escape
process-tree-walk reapers. Writes its own pid to .zscripts/dev.pid."""
import os, sys, time

DEV_PID_FILE = "/home/z/my-project/.zscripts/dev.pid"
DEV_LOG = "/home/z/my-project/dev.log"

def daemonize():
    # First fork
    try:
        if os.fork() > 0:
            sys.exit(0)
    except OSError as e:
        sys.exit(1)
    os.setsid()
    os.umask(0)
    # Second fork
    try:
        if os.fork() > 0:
            sys.exit(0)
    except OSError as e:
        sys.exit(1)
    # Redirect std streams to dev.log
    sys.stdout.flush()
    sys.stderr.flush()
    logfd = os.open(DEV_LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.dup2(logfd, 1)
    os.dup2(logfd, 2)
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, 0)
    os.chdir("/home/z/my-project")
    # Record our pid
    with open(DEV_PID_FILE, "w") as f:
        f.write(str(os.getpid()))
    # Exec the dev server (replaces the daemon process)
    os.execvp("bun", ["bun", "run", "dev"])

if __name__ == "__main__":
    daemonize()
