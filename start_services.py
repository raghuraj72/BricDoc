import subprocess
import sys
import os
import time
import requests

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

DETACHED_FLAGS = 0x00000008 | 0x00000200

def is_running(url):
    try:
        r = requests.get(url, timeout=2)
        return r.status_code == 200
    except Exception:
        return False

def main():
    print("Checking BricDoc services on dedicated ports (8005 / 3005)...")
    backend_up = is_running("http://127.0.0.1:8005/health")
    frontend_up = is_running("http://localhost:3005/")

    if not backend_up:
        print("Launching BricDoc Backend (FastAPI on 127.0.0.1:8005)...")
        b_proc = subprocess.Popen(
            [sys.executable, "run_backend.py"],
            cwd=BACKEND_DIR,
            creationflags=DETACHED_FLAGS,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True
        )
        print(f"  Backend detached PID: {b_proc.pid}")
    else:
        print("  Backend is already up on port 8005.")

    if not frontend_up:
        print("Launching BricDoc Frontend (Next.js on localhost:3005)...")
        f_proc = subprocess.Popen(
            ["node.exe", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3005"],
            cwd=FRONTEND_DIR,
            creationflags=DETACHED_FLAGS,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True
        )
        print(f"  Frontend detached PID: {f_proc.pid}")
    else:
        print("  Frontend is already up on port 3005.")

    # Wait for services to be ready
    for i in range(15):
        time.sleep(1)
        b = is_running("http://127.0.0.1:8005/health")
        f = is_running("http://localhost:3005/")
        if b and f:
            print("\n>>> ALL BRICDOC SERVICES ARE ACTIVE AND RUNNING! <<<")
            print("  Web App:  http://localhost:3005")
            print("  API Docs: http://127.0.0.1:8005/api/v1/docs")
            return 0

    print("Warning: One or more services did not respond within 15 seconds.")
    return 1

if __name__ == "__main__":
    sys.exit(main())
