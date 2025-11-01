from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0032_alter_sale_invoice_number_and_more"),
        ("api", "0032_merge_20251017_0951"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="barcode",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="brand",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="category",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="subcategory",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="tags",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="unit_of_measure",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
