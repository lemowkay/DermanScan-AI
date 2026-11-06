
import time
from collections import defaultdict, deque
from threading import Lock

_hits = defaultdict(deque)
_lock = Lock()


def too_many(key, limit, window_seconds):
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        return len(q) >= limit


def record(key):
    with _lock:
        _hits[key].append(time.time())


def clear(key):
    with _lock:
        _hits.pop(key, None)


def retry_after(key, window_seconds):
    with _lock:
        q = _hits.get(key)
        if not q:
            return 0
        return max(1, int(window_seconds - (time.time() - q[0])))
