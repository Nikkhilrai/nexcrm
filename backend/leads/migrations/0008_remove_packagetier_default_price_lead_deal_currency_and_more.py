# Phase 2.10 cut-over — dual-currency tier prices + per-lead deal_currency.
#
# The autodetector wanted to drop `default_price` and add `default_price_inr` +
# `default_price_usd` cleanly, which would have nuked the 63 seeded ₹ prices
# already in the column. Hand-edited to use a RenameField for the INR side
# (preserves existing data) and a separate AddField for the new USD column.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0007_alter_packagetier_options_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='packagetier',
            old_name='default_price',
            new_name='default_price_inr',
        ),
        migrations.AlterField(
            model_name='packagetier',
            name='default_price_inr',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Suggested deal_value (₹) when a lead in this tier converts.',
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='packagetier',
            name='default_price_usd',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Suggested deal_value ($) when a lead in this tier converts.',
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='lead',
            name='deal_currency',
            field=models.CharField(
                choices=[('INR', 'Indian Rupee (₹)'), ('USD', 'US Dollar ($)')],
                default='INR',
                help_text=(
                    'Currency the deal_value was negotiated in. Each deal '
                    'carries one currency; tiers can advertise both ₹ and $ prices.'
                ),
                max_length=3,
            ),
        ),
    ]
