"""Password hashing (argon2) and opaque session-token helpers."""
import hashlib
import secrets

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def generate_session_token() -> str:
    """Return a high-entropy opaque token to hand to the client."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Store only the hash of a session token, never the token itself."""
    return hashlib.sha256(token.encode()).hexdigest()
