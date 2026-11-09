import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.worker import PDFWorker

if __name__ == "__main__":
    worker = PDFWorker()
    worker.run()
