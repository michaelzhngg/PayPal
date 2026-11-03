import sys
from pathlib import Path

# The backend has no pytest config, so make `engine` importable when pytest is run from backend/.
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
