"""Utilities for generating PDF invoices."""

from io import BytesIO
from pathlib import Path
from typing import IO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

from .models import CompanyInfo, Sale

FONT_DIR = Path(__file__).resolve().parent / 'fonts'
FONT_REGULAR = 'DejaVuSans'
FONT_BOLD = 'DejaVuSans-Bold'


def _register_font(font_name: str, file_name: str) -> None:
    """Register a TrueType font with ReportLab if it hasn't been registered."""
    try:
        pdfmetrics.getFont(font_name)
    except KeyError:
        font_path = FONT_DIR / file_name
        pdfmetrics.registerFont(TTFont(font_name, str(font_path)))


def _ensure_custom_fonts() -> None:
    """Ensure the fonts used in the invoice are available to ReportLab."""
    _register_font(FONT_REGULAR, 'DejaVuSans.ttf')
    _register_font(FONT_BOLD, 'DejaVuSans-Bold.ttf')


def _build_image_flowable(image_field, width, height, **image_kwargs):
    """Return a ReportLab Image flowable for the provided Django ImageField."""
    if not image_field:
        return ''

    # Prefer using the filesystem path when it is available.
    image_path = getattr(image_field, 'path', None)
    if image_path:
        try:
            return Image(image_path, width=width, height=height, **image_kwargs)
        except Exception:
            pass

    # Fallback to loading the bytes through Django's storage backend.
    try:
        image_field.open()
        try:
            image_bytes = image_field.read()
        finally:
            image_field.close()
        if image_bytes:
            return Image(ImageReader(BytesIO(image_bytes)), width=width, height=height, **image_kwargs)
    except Exception:
        return ''

    return ''

def generate_invoice_pdf(sale: Sale) -> IO[bytes]:
    """Generate a professional PDF invoice for the given ``Sale`` instance."""

    buffer = BytesIO()

    _ensure_custom_fonts()

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

    # --- Currency Handling ---
    currency_code = 'USD'
    if getattr(sale, 'customer', None) and getattr(sale.customer, 'currency', None):
        currency_code = sale.customer.currency or 'USD'
    elif getattr(sale, 'supplier', None) and getattr(sale.supplier, 'currency', None):
        currency_code = sale.supplier.currency or 'USD'
    currency_symbols = {
        'USD': '$',
        'EUR': '€',
        'KZT': '₸',
        'TRY': '₺',
    }
    currency_symbol = currency_symbols.get(currency_code, '$')

    # --- Styles ---
    styles = getSampleStyleSheet()
    styles['Normal'].fontName = FONT_REGULAR
    styles.add(ParagraphStyle(name='CompanyName', fontSize=18, fontName=FONT_BOLD))
    styles.add(ParagraphStyle(name='CompanyInfo', fontSize=10, fontName=FONT_REGULAR))
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=14, fontName=FONT_BOLD, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='InvoiceInfo', fontSize=10, fontName=FONT_REGULAR, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='BillTo', fontSize=10, fontName=FONT_BOLD))
    styles.add(ParagraphStyle(name='TableHead', fontSize=10, fontName=FONT_BOLD, alignment=TA_CENTER, textColor=colors.whitesmoke))
    styles.add(ParagraphStyle(name='TableCell', fontSize=10, fontName=FONT_REGULAR))
    styles.add(ParagraphStyle(name='TableCellRight', fontSize=10, fontName=FONT_REGULAR, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='TotalLabel', fontSize=10, fontName=FONT_BOLD, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='TotalValue', fontSize=10, fontName=FONT_REGULAR, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='GrandTotalLabel', fontSize=12, fontName=FONT_BOLD, alignment=TA_RIGHT))

    elements = []

    # --- 1. Header Section (Logo and Company Info) ---
    company_logo = _build_image_flowable(getattr(company, 'logo', None), width=40 * mm, height=20 * mm, hAlign='LEFT')
    if not company_logo:
        company_logo = Paragraph("No Logo", styles['CompanyInfo'])

    company_details_data = [
        [company_logo],
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
        img_obj = _build_image_flowable(getattr(item.product, 'image', None), width=15 * mm, height=15 * mm)

        data.append([
            img_obj,
            Paragraph(item.product.name, styles['TableCell']),
            Paragraph(f"{item.quantity}", styles['TableCellRight']),
            Paragraph(f"{currency_symbol}{item.unit_price:,.2f}", styles['TableCellRight']),
            Paragraph(f"{currency_symbol}{item.line_total:,.2f}", styles['TableCellRight']),
        ])

    items_table = Table(data, colWidths=[20 * mm, 70 * mm, 20 * mm, 30 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F4F4F')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
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
        [Paragraph('Subtotal:', styles['TotalLabel']), Paragraph(f'{currency_symbol}{sale.total_amount:,.2f}', styles['TotalValue'])],
        [Paragraph('Total Paid:', styles['TotalLabel']), Paragraph(f'{currency_symbol}{total_paid:,.2f}', styles['TotalValue'])],
        [Paragraph('Balance Due:', styles['GrandTotalLabel']), Paragraph(f'{currency_symbol}{balance_due:,.2f}', styles['GrandTotalLabel'])],
    ]

    totals_table = Table(totals_data, colWidths=[40 * mm, 30 * mm])
    totals_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LINEABOVE', (0,2), (1,2), 1, colors.black),
        ('TOPPADDING', (0,2), (1,2), 3),
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
    buffer.seek(0)
    return buffer
