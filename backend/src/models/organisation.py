from src.config.database import query


def create_org(name: str) -> dict:
    result = query(
        "INSERT INTO organisations (name) VALUES (%s) RETURNING *",
        (name,),
        fetch="one"
    )
    return dict(result)


def add_member(org_id: str, user_id: str, role: str = "owner") -> dict:
    result = query(
        """
        INSERT INTO org_members (org_id, user_id, role)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (org_id, user_id, role),
        fetch="one"
    )
    return dict(result)


def get_org_by_user(user_id: str) -> dict:
    result = query(
        """
        SELECT o.* FROM organisations o
        JOIN org_members m ON m.org_id = o.id
        WHERE m.user_id = %s
        LIMIT 1
        """,
        (user_id,),
        fetch="one"
    )
    return dict(result) if result else None