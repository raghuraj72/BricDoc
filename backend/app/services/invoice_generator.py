"""
Professional PDF Invoice & Receipt Generation Service.
Generates compliant, beautifully formatted PDF tax invoices using ReportLab.
"""

import os
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import inch

from app.core.config import settings
from app.models.payment import Invoice


class InvoiceGenerator:
    """Service to render and store professional tax invoice PDFs."""

    @staticmethod
    def generate_invoice_pdf(invoice: Invoice) -> str:
        """
        Renders a PDF tax invoice for the given invoice model.
        Returns the absolute filepath of the generated PDF.
        """
        filename = f"{invoice.invoice_number}.pdf"
        output_dir = os.path.join(settings.STORAGE_DIR, "invoices")
        os.makedirs(output_dir, exist_ok=True)
        pdf_path = os.path.join(output_dir, filename)

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        bold = styles["Heading3"]

        # Custom styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica-Bold"
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=normal,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748b")
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=normal,
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0f172a"),
            fontName="Helvetica-Bold"
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=normal,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155")
        )
        table_cell_bold = ParagraphStyle(
            "TableCellBold",
            parent=normal,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0f172a"),
            fontName="Helvetica-Bold"
        )
        paid_stamp = ParagraphStyle(
            "PaidStamp",
            parent=normal,
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#16a34a"),
            fontName="Helvetica-Bold",
            alignment=2  # Right-aligned
        )

        elements = []

        # 1. Header (Company details & Invoice title)
        header_table_data = [
            [
                Paragraph(f"<b>{settings.COMPANY_NAME}</b><br/>{settings.COMPANY_ADDRESS}<br/>Email: {settings.COMPANY_EMAIL}{f'<br/>GSTIN: {settings.COMPANY_GSTIN}' if settings.COMPANY_GSTIN else ''}", subtitle_style),
                Paragraph("<b>TAX INVOICE</b><br/><font color='#16a34a'><b>STATUS: PAID</b></font>", paid_stamp)
            ]
        ]
        header_table = Table(header_table_data, colWidths=[4.0 * inch, 3.5 * inch])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 14))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=14))

        # 2. Invoice Meta & Bill To Info
        issued_date_str = invoice.issued_at.strftime("%d %B %Y, %I:%M %p UTC") if invoice.issued_at else datetime.now(timezone.utc).strftime("%d %B %Y")
        meta_table_data = [
            [
                Paragraph("<b>Billed To:</b>", section_heading),
                Paragraph("<b>Invoice Details:</b>", section_heading)
            ],
            [
                Paragraph(f"<b>{invoice.customer_name}</b><br/>{invoice.customer_email}{f'<br/>Address: {invoice.customer_address}' if invoice.customer_address else ''}", table_cell),
                Paragraph(f"<b>Invoice No:</b> {invoice.invoice_number}<br/><b>Invoice Date:</b> {issued_date_str}<br/><b>Payment Gateway:</b> Razorpay<br/><b>Currency:</b> {invoice.currency}", table_cell)
            ]
        ]
        meta_table = Table(meta_table_data, colWidths=[4.0 * inch, 3.5 * inch])
        meta_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 16))

        # 3. Line Items Table
        subtotal_inr = invoice.amount_subtotal / 100.0
        cgst_inr = invoice.cgst_amount / 100.0
        sgst_inr = invoice.sgst_amount / 100.0
        total_tax_inr = invoice.tax_amount / 100.0
        total_inr = invoice.amount_total / 100.0

        plan_desc = f"BricDoc {invoice.plan_tier.capitalize()} Subscription (30-day billing cycle)"
        items_data = [
            [
                Paragraph("<b>Description</b>", table_cell_bold),
                Paragraph("<b>Qty</b>", table_cell_bold),
                Paragraph("<b>Rate (₹)</b>", table_cell_bold),
                Paragraph("<b>Amount (₹)</b>", table_cell_bold)
            ],
            [
                Paragraph(plan_desc, table_cell),
                Paragraph("1", table_cell),
                Paragraph(f"₹{subtotal_inr:.2f}", table_cell),
                Paragraph(f"₹{subtotal_inr:.2f}", table_cell)
            ],
            [
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("<b>Subtotal:</b>", table_cell_bold),
                Paragraph(f"₹{subtotal_inr:.2f}", table_cell_bold)
            ],
            [
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("CGST (9.0%):", table_cell),
                Paragraph(f"₹{cgst_inr:.2f}", table_cell)
            ],
            [
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("SGST (9.0%):", table_cell),
                Paragraph(f"₹{sgst_inr:.2f}", table_cell)
            ],
            [
                Paragraph("", table_cell),
                Paragraph("", table_cell),
                Paragraph("<b>Total Paid:</b>", table_cell_bold),
                Paragraph(f"<b>₹{total_inr:.2f}</b>", table_cell_bold)
            ]
        ]

        items_table = Table(items_data, colWidths=[4.2 * inch, 0.7 * inch, 1.3 * inch, 1.3 * inch])
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#cbd5e1")),
            ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.HexColor("#e2e8f0")),
            ("LINEBELOW", (2, -1), (3, -1), 1.5, colors.HexColor("#0f172a")),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 24))

        # 4. Footer Note & Terms
        footer_text = Paragraph(
            "<b>Payment Confirmation:</b> This is an electronically generated tax invoice confirming receipt of payment through Razorpay.<br/>"
            "For billing assistance, refunds, or invoice inquiries, contact support at <b>billing@bricdoc.com</b>.<br/>"
            "Thank you for powering your document productivity with BricDoc!",
            subtitle_style
        )
        elements.append(footer_text)

        doc.build(elements)
        invoice.pdf_path = pdf_path
        return pdf_path

    @staticmethod
    def generate_pdf(invoice: Invoice, **kwargs) -> str:
        return InvoiceGenerator.generate_invoice_pdf(invoice)
