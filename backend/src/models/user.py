from src.config.database import query
from typing import Optional


def get_user_by_email(email: str) -> Optional[dict]:
    """Find a user by their email address"""
    result = query(
        "SELECT * FROM users WHERE email = %s LIMIT 1",
        (email,),
        fetch="one"
    )
    return dict(result) if result else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Find a user by their ID"""
    result = query(
        "SELECT * FROM users WHERE id = %s LIMIT 1",
        (user_id,),
        fetch="one"
    )
    return dict(result) if result else None


def create_user(name: str, email: str, password_hash: str) -> dict:
    """Create a new user and return the created record"""
    result = query(
        """
        INSERT INTO users (name, email, password_hash)
        VALUES (%s, %s, %s)
        RETURNING id, name, email, created_at
        """,
        (name, email, password_hash),
        fetch="one"
    )
    return dict(result)