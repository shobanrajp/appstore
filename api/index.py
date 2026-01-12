import os
import sys

# Add the backend directory to sys.path to allow importing server and its dependencies
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, 'backend')

if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Now likely strictly importing from backend/server.py because we renamed api/server.py
from server import app
