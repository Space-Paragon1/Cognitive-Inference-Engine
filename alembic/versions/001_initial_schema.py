"""Initial schema — users and timeline tables.

Revision ID: 001
Revises:
Create Date: 2026-03-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("created_at", sa.Float, nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("idx_users_email", "users", ["email"])

    op.create_table(
        "timeline",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.Float, nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("load_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("context", sa.String(64), nullable=False, server_default="unknown"),
        sa.Column("metadata_json", sa.Text, nullable=False, server_default="{}"),
        sa.Column("user_id", sa.Integer, nullable=True),
    )
    op.create_index("idx_ts", "timeline", ["timestamp"])


def downgrade() -> None:
    op.drop_index("idx_ts", table_name="timeline")
    op.drop_table("timeline")
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")
