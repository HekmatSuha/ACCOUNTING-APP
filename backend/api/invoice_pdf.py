from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from .models import CompanyInfo, Sale

def generate_invoice_pdf(sale):
    """Generate a professional PDF invoice for the given Sale instance."""
    buffer = BytesIO()

    # --- Document Setup ---
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=f"Invoice {sale.invoice_number or sale.id}",
        author="MyAccountingApp"
    )

    # --- Fetch Company Info ---
    company = CompanyInfo.load()

    # --- Styles ---
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CompanyName', fontSize=18, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='CompanyInfo', fontSize=10, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=14, fontName='Helvetica-Bold', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='InvoiceInfo', fontSize=10, fontName='Helvetica', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='BillTo', fontSize=10, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='TableHead', fontSize=10, fontName='Helvetica-Bold', alignment=TA_CENTER, textColor=colors.whitesmoke))
    styles.add(ParagraphStyle(name='TableCell', fontSize=10, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='TableCellRight', fontSize=10, fontName='Helvetica', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='TotalLabel', fontSize=10, fontName='Helvetica-Bold', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='TotalValue', fontSize=10, fontName='Helvetica', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='GrandTotalLabel', fontSize=12, fontName='Helvetica-Bold', alignment=TA_RIGHT))

    elements = []

    # --- 1. Header Section (Logo and Company Info) ---
    company_logo = None
    if company.logo:
        try:
            company_logo = Image(company.logo.path, width=40 * mm, height=20 * mm, hAlign='LEFT')
        except Exception:
            company_logo = Paragraph("No Logo", styles['CompanyInfo'])

    company_details_data = [
        [Paragraph(company.name, styles['CompanyName'])],
        [Paragraph(company.address or '', styles['CompanyInfo'])],
        [Paragraph(f"{company.phone or ''}", styles['CompanyInfo'])],
        [Paragraph(f"{company.email or ''}", styles['CompanyInfo'])],
        [Paragraph(company.website or '', styles['CompanyInfo'])],
    ]
    company_details_table = Table(company_details_data, colWidths=[80*mm])
    company_details_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))


    invoice_info_data = [
        [Paragraph('INVOICE', styles['InvoiceTitle'])],
        [Paragraph(f"# {sale.invoice_number or sale.id}", styles['InvoiceInfo'])],
        [Paragraph(f"Date: {sale.sale_date.strftime('%d %b, %Y')}", styles['InvoiceInfo'])],
    ]
    invoice_info_table = Table(invoice_info_data, colWidths=[80*mm])
    invoice_info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))


    header_data = [[company_details_table, invoice_info_table]]
    header_table = Table(header_data, colWidths=[90 * mm, 80 * mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    elements.append(header_table)
    elements.append(Spacer(1, 15 * mm))

    # --- 2. Bill To Section ---
    customer_name = sale.customer.name if sale.customer else (sale.supplier.name if sale.supplier else "N/A")
    customer_address = sale.customer.address if sale.customer else (sale.supplier.address if sale.supplier else "")

    bill_to_data = [
        [Paragraph("BILL TO", styles['BillTo'])],
        [Paragraph(customer_name, styles['Normal'])],
        [Paragraph(customer_address or '', styles['Normal'])],
    ]
    bill_to_table = Table(bill_to_data, colWidths=[170*mm])
    bill_to_table.setStyle(TableStyle([('BOTTOMPADDING', (0,0), (-1,-1), 1)]))

    elements.append(bill_to_table)
    elements.append(Spacer(1, 10 * mm))


    # --- 3. Items Table ---
    table_header = [
        Paragraph('Image', styles['TableHead']),
        Paragraph('Item Description', styles['TableHead']),
        Paragraph('Qty', styles['TableHead']),
        Paragraph('Unit Price', styles['TableHead']),
        Paragraph('Total', styles['TableHead']),
    ]
    data = [table_header]

    for item in sale.items.all():
        img_obj = ''
        if item.product.image and hasattr(item.product.image, 'path'):
            try:
                img_obj = Image(item.product.image.path, width=15*mm, height=15*mm)
            except Exception:
                img_obj = '' # Fails gracefully

        data.append([
            img_obj,
            Paragraph(item.product.name, styles['TableCell']),
            Paragraph(f"{item.quantity}", styles['TableCellRight']),
            Paragraph(f"${item.unit_price:,.2f}", styles['TableCellRight']),
            Paragraph(f"${item.line_total:,.2f}", styles['TableCellRight']),
        ])

    items_table = Table(data, colWidths=[20 * mm, 70 * mm, 20 * mm, 30 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F4F4F')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0, 0), (-1, 0), 3 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 3 * mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2 * mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2 * mm),
    ]))
    elements.append(items_table)

    # --- 4. Totals Section ---
    total_paid = sum(p.converted_amount for p in sale.payments.all())
    balance_due = sale.total_amount - total_paid

    totals_data = [
        [Paragraph('Subtotal:', styles['TotalLabel']), Paragraph(f'${sale.total_amount:,.2f}', styles['TotalValue'])],
        [Paragraph('Total Paid:', styles['TotalLabel']), Paragraph(f'${total_paid:,.2f}', styles['TotalValue'])],
        [], # Spacer
        [Paragraph('Balance Due:', styles['GrandTotalLabel']), Paragraph(f'${balance_due:,.2f}', styles['GrandTotalLabel'])],
    ]

    totals_table = Table(totals_data, colWidths=[40 * mm, 30 * mm])
    totals_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LINEABOVE', (0,3), (1,3), 1, colors.black),
        ('TOPPADDING', (0,3), (1,3), 3),
    ]))

    wrapper_table = Table([[totals_table]], colWidths=[170*mm], style=[('ALIGN', (0,0), (-1,-1), 'RIGHT')])
    elements.append(wrapper_table)
    elements.append(Spacer(1, 20 * mm))

    # --- 5. Footer / Notes ---
    elements.append(Paragraph("Thank you for your business!", styles['Normal']))
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph("Please feel free to contact us with any questions.", styles['Normal']))


    # --- Build PDF ---
    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
