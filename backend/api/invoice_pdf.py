from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image


def generate_invoice_pdf(sale):
    """Generate a PDF invoice for the given ``Sale`` instance."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)

    elements = []
    styles = getSampleStyleSheet()

    invoice_no = sale.invoice_number or str(sale.id)
    elements.append(Paragraph(f"Invoice #{invoice_no}", styles['Title']))
    elements.append(Spacer(1, 12))

    if sale.customer:
        elements.append(Paragraph(f"Bill To: {sale.customer.name}", styles['Normal']))
    elif sale.supplier:
        elements.append(Paragraph(f"Sold To: {sale.supplier.name}", styles['Normal']))
    elements.append(Paragraph(f"Date: {sale.sale_date}", styles['Normal']))
    elements.append(Spacer(1, 12))

    data = [["Image", "Item", "Qty", "Unit Price", "Total"]]
    for item in sale.items.all():
        img = ""
        if item.product.image:
            try:
                img_path = item.product.image.path
                img = Image(img_path, width=25 * mm, height=25 * mm)
            except Exception:
                img = ""
        data.append([
            img,
            item.product.name,
            f"{item.quantity}",
            f"{item.unit_price}",
            f"{item.line_total}",
        ])

    table = Table(data, colWidths=[30 * mm, 70 * mm, 20 * mm, 30 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    elements.append(Paragraph(f"Grand Total: {sale.total_amount}", styles['Heading2']))

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

