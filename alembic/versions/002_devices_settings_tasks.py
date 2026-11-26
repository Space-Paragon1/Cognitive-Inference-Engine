"""Per-user state: device tokens, pairing codes, settings, tasks.

Also creates password_reset_tokens, which 001 never did (production databases
got it from metadata.create_all at startup), and adds a (user_id, timestamp)
index on the timeline.

Every step checks what already exists, so this migration is safe to run on a
database that was partly created by metadata.create_all().

Revision ID: 002
Revises: 001
Create Date: 2026-11-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _indexes(table: str) -> set[str]:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    existing = _tables()

    if "password_reset_tokens" not in existing:
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer, nullable=False, index=True),
            sa.Column("token", sa.String(64), nullable=False, unique=True),
            sa.Column("expires_at", sa.Float, nullable=False),
            sa.Column("used", sa.Boolean, nullable=False, server_default=sa.false()),
        )

    if "device_tokens" not in existing:
        op.create_table(
            "device_tokens",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer, nullable=False, index=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("kind", sa.String(32), nullable=False),
            sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
            sa.Column("created_at", sa.Float, nullable=False),
            sa.Column("last_seen_at", sa.Float, nullable=True),
            sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.false()),
        )

    if "pairing_codes" not in existing:
        op.create_table(
            "pairing_codes",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer, nullable=False, index=True),
            sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
            sa.Column("expires_at", sa.Float, nullable=False),
            sa.Column("used", sa.Boolean, nullable=False, server_default=sa.false()),
        )

    if "user_settings" not in existing:
        op.create_table(
            "user_settings",
            sa.Column("user_id", sa.Integer, primary_key=True, autoincrement=False),
            sa.Column("settings_json", sa.Text, nullable=False, server_default="{}"),
            sa.Column("updated_at", sa.Float, nullable=False),
        )

    if "tasks" not in existing:
        op.create_table(
            "tasks",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer, nullable=False, index=True),
            sa.Column("task_id", sa.String(128), nullable=False),
            sa.Column("title", sa.Text, nullable=False),
            sa.Column("difficulty", sa.String(16), nullable=False),
            sa.Column("estimated_minutes", sa.Integer, nullable=False, server_default="25"),
            sa.Column("tags_json", sa.Text, nullable=False, server_default="[]"),
            sa.Column("created_at", sa.Float, nullable=False),
            sa.UniqueConstraint("user_id", "task_id", name="uq_tasks_user_task"),
        )

    if "idx_timeline_user_ts" not in _indexes("timeline"):
        op.create_index("idx_timeline_user_ts", "timeline", ["user_id", "timestamp"])

    # Reset tokens are now stored as SHA-256 hashes, so any plaintext token
    # still in the table can never match again. They expire within an hour
    # anyway; clear them so the table only holds hashes.
    op.execute("DELETE FROM password_reset_tokens")


def downgrade() -> None:
    op.drop_index("idx_timeline_user_ts", table_name="timeline")
    op.drop_table("tasks")
    op.drop_table("user_settings")
    op.drop_table("pairing_codes")
    op.drop_table("device_tokens")
