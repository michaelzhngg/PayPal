"""add PayPal payee fields to employees and provider fields to payouts

Revision ID: f1a2b3c4d5e6
Revises: de1ad2be3cf4
Create Date: 2026-11-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'de1ad2be3cf4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('employees', sa.Column('paypal_payer_id', sa.String(), nullable=True))
    op.add_column('employees', sa.Column('paypal_email', sa.String(), nullable=True))
    op.add_column('employees', sa.Column('paypal_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('employees', sa.Column('paypal_linked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('employees', sa.Column('payout_destination_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_employees_paypal_payer_id'), 'employees', ['paypal_payer_id'], unique=False)

    op.add_column('payouts', sa.Column('provider', sa.String(), nullable=False, server_default='PAYPAL'))
    op.add_column('payouts', sa.Column('provider_batch_id', sa.String(), nullable=True))
    op.add_column('payouts', sa.Column('provider_item_id', sa.String(), nullable=True))
    op.add_column('payouts', sa.Column('attempt', sa.Integer(), nullable=False, server_default='1'))
    op.create_index(op.f('ix_payouts_provider_batch_id'), 'payouts', ['provider_batch_id'], unique=False)
    op.create_index(op.f('ix_payouts_provider_item_id'), 'payouts', ['provider_item_id'], unique=False)
    # Rows written before this migration came from Xendit.
    op.execute("UPDATE payouts SET provider = 'XENDIT' WHERE xendit_id IS NOT NULL")


def downgrade() -> None:
    op.drop_index(op.f('ix_payouts_provider_item_id'), table_name='payouts')
    op.drop_index(op.f('ix_payouts_provider_batch_id'), table_name='payouts')
    op.drop_column('payouts', 'attempt')
    op.drop_column('payouts', 'provider_item_id')
    op.drop_column('payouts', 'provider_batch_id')
    op.drop_column('payouts', 'provider')

    op.drop_index(op.f('ix_employees_paypal_payer_id'), table_name='employees')
    op.drop_column('employees', 'payout_destination_changed_at')
    op.drop_column('employees', 'paypal_linked_at')
    op.drop_column('employees', 'paypal_verified')
    op.drop_column('employees', 'paypal_email')
    op.drop_column('employees', 'paypal_payer_id')
