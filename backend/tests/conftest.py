import os

os.environ.setdefault("SECRET_KEY", "test-secret-not-default")
os.environ.setdefault("PAYPAL_MOCK_MODE", "true")
