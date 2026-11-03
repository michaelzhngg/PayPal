"""reclaim pay: autonomy fields, receipt fingerprints, autonomy_settings, recoveries, agent_actions

Revision ID: 1f551d7ef95b
Revises: f1a2b3c4d5e6
Create Date: 2026-11-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '1f551d7ef95b'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMPTY_OBJECT = sa.text("'{}'::jsonb")
EMPTY_ARRAY = sa.text("'[]'::jsonb")


def upgrade() -> None:
    op.add_column('reimbursements', sa.Column('tier', sa.String(), nullable=True))
    op.add_column('reimbursements', sa.Column('risk_score', sa.Integer(), nullable=True))
    op.add_column('reimbursements', sa.Column('autonomy', postgresql.JSONB(), nullable=False, server_default=EMPTY_OBJECT))
    op.add_column('reimbursements', sa.Column('audit_selected', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('reimbursements', sa.Column('approvals', postgresql.JSONB(), nullable=False, server_default=EMPTY_ARRAY))
    op.create_index(op.f('ix_reimbursements_tier'), 'reimbursements', ['tier'], unique=False)

    op.add_column('supporting_documents', sa.Column('sha256', sa.String(), nullable=True))
    op.add_column('supporting_documents', sa.Column('phash', sa.String(), nullable=True))
    op.add_column('supporting_documents', sa.Column('shield', postgresql.JSONB(), nullable=False, server_default=EMPTY_OBJECT))
    op.create_index(op.f('ix_supporting_documents_sha256'), 'supporting_documents', ['sha256'], unique=False)
    op.create_index(op.f('ix_supporting_documents_phash'), 'supporting_documents', ['phash'], unique=False)

    op.create_table(
        'autonomy_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config', postgresql.JSONB(), nullable=False, server_default=EMPTY_OBJECT),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('breaker_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['employees.user_id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'recoveries',
        sa.Column('recovery_id', sa.Uuid(), nullable=False),
        sa.Column('reim_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('dispute_until', sa.DateTime(timezone=True), nullable=False),
        sa.Column('dispute_note', sa.Text(), nullable=True),
        sa.Column('offset_reim_id', sa.Uuid(), nullable=True),
        sa.Column('paypal_invoice_id', sa.String(), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reim_id'], ['reimbursements.reim_id']),
        sa.ForeignKeyConstraint(['user_id'], ['employees.user_id']),
        sa.ForeignKeyConstraint(['offset_reim_id'], ['reimbursements.reim_id']),
        sa.ForeignKeyConstraint(['created_by'], ['employees.user_id']),
        sa.PrimaryKeyConstraint('recovery_id'),
    )
    op.create_index(op.f('ix_recoveries_reim_id'), 'recoveries', ['reim_id'], unique=False)
    op.create_index(op.f('ix_recoveries_user_id'), 'recoveries', ['user_id'], unique=False)
    op.create_index(op.f('ix_recoveries_status'), 'recoveries', ['status'], unique=False)
    op.create_index(op.f('ix_recoveries_paypal_invoice_id'), 'recoveries', ['paypal_invoice_id'], unique=False)

    op.create_table(
        'agent_actions',
        sa.Column('action_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('actor', sa.String(), nullable=False),
        sa.Column('reim_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('payload', postgresql.JSONB(), nullable=False, server_default=EMPTY_OBJECT),
        sa.Column('prev_hash', sa.String(length=64), nullable=False),
        sa.Column('hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('action_id'),
        sa.UniqueConstraint('hash'),
    )
    op.create_index(op.f('ix_agent_actions_action_type'), 'agent_actions', ['action_type'], unique=False)
    op.create_index(op.f('ix_agent_actions_reim_id'), 'agent_actions', ['reim_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_actions_reim_id'), table_name='agent_actions')
    op.drop_index(op.f('ix_agent_actions_action_type'), table_name='agent_actions')
    op.drop_table('agent_actions')

    op.drop_index(op.f('ix_recoveries_paypal_invoice_id'), table_name='recoveries')
    op.drop_index(op.f('ix_recoveries_status'), table_name='recoveries')
    op.drop_index(op.f('ix_recoveries_user_id'), table_name='recoveries')
    op.drop_index(op.f('ix_recoveries_reim_id'), table_name='recoveries')
    op.drop_table('recoveries')

    op.drop_table('autonomy_settings')

    op.drop_index(op.f('ix_supporting_documents_phash'), table_name='supporting_documents')
    op.drop_index(op.f('ix_supporting_documents_sha256'), table_name='supporting_documents')
    op.drop_column('supporting_documents', 'shield')
    op.drop_column('supporting_documents', 'phash')
    op.drop_column('supporting_documents', 'sha256')

    op.drop_index(op.f('ix_reimbursements_tier'), table_name='reimbursements')
    op.drop_column('reimbursements', 'approvals')
    op.drop_column('reimbursements', 'audit_selected')
    op.drop_column('reimbursements', 'autonomy')
    op.drop_column('reimbursements', 'risk_score')
    op.drop_column('reimbursements', 'tier')
