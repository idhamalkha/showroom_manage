import logging
import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Try to import WeasyPrint for PDF generation. If not present, generate_pdf will raise a helpful error.
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False


def render_invoice_html(transaksi: Any, client: Any, sales: Any, details: List[Dict], mobil: Optional[Dict] = None) -> str:
    """Return a tasteful HTML invoice string for the given transaction data.

    The function expects transaksi to have fields like kd_transaksi, total_bayar, created_at etc.
    details is a list of line-items (name, qty, price, subtotal) if available. mobil can be a dict
    with car specifications.
    """
    created = getattr(transaksi, 'created_at', None) or datetime.datetime.utcnow()
    created_str = created.strftime('%Y-%m-%d %H:%M') if hasattr(created, 'strftime') else str(created)
    seller_name = getattr(sales, 'nama', getattr(sales, 'name', '')) if sales else ''
    buyer_name = getattr(client, 'nama', getattr(client, 'name', '')) if client else ''
    buyer_email = getattr(client, 'email', '') if client else ''

    # Basic inline CSS for a clean "luxury" look. Keep CSS simple and printable.
    styles = """
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #222; }
    .invoice { max-width: 900px; margin: 24px auto; padding: 28px; border: 1px solid #e6e6e6; border-radius: 8px; }
    .header { display:flex; justify-content:space-between; align-items:center; }
    .logo { font-weight:700; font-size:20px; color: #0b5; }
    .meta { text-align:right; }
    .title { font-size:18px; margin-top:8px; margin-bottom:16px; }
    .details { margin-top:18px; display:flex; justify-content:space-between; gap:12px; }
    .box { border:1px solid #f0f0f0; padding:12px; border-radius:6px; flex:1; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th, td { padding:10px 8px; border-bottom:1px solid #efefef; text-align:left; }
    th { background:#fafafa; color:#333; }
    .total { text-align:right; font-size:18px; font-weight:700; margin-top:12px; }
    .footer { margin-top:24px; font-size:12px; color:#666; text-align:center; }
    .car-specs { margin-top:12px; }
    .small { font-size:13px; color:#555; }
    """

    # Header + metadata
    html = [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8" />',
        f'<title>Invoice {getattr(transaksi, "kd_transaksi", "")}</title>',
        '<style>', styles, '</style>',
        '</head>',
        '<body>',
        '<div class="invoice">',
        '<div class="header">',
        f'<div class="logo">SHOWROOM</div>',
        '<div class="meta">',
        f'<div>Invoice: <strong>{getattr(transaksi, "kd_transaksi", "")}</strong></div>',
        f'<div class="small">Date: {created_str}</div>',
        f'<div class="small">Sales: {seller_name}</div>',
        '</div>',
        '</div>',
        f'<h2 class="title">Thank you for your purchase, {buyer_name or "Customer"}.</h2>',

        '<div class="details">',
        '<div class="box">',
        '<div><strong>Buyer</strong></div>',
        f'<div class="small">{buyer_name}</div>',
        f'<div class="small">{buyer_email}</div>',
        '</div>',
        '<div class="box">',
        '<div><strong>Payment</strong></div>',
        f'<div class="small">Total: Rp {getattr(transaksi, "total_bayar", "-")}</div>',
        f'<div class="small">Status: {getattr(transaksi, "status", "-")}</div>',
        '</div>',
        '</div>'
    ]

    # If details exist, render a table
    if details:
        html.append('<table>')
        html.append('<thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>')
        html.append('<tbody>')
        for d in details:
            nama = d.get('nama') or d.get('name') or d.get('item') or '-'
            qty = d.get('qty', 1)
            price = d.get('harga') or d.get('price') or '-'
            subtotal = d.get('subtotal') or d.get('subtotal_harga') or '-'
            html.append(f'<tr><td>{nama}</td><td>{qty}</td><td>Rp {price}</td><td>Rp {subtotal}</td></tr>')
        html.append('</tbody>')
        html.append('</table>')
    else:
        # Try to show mobil specs if available
        if mobil:
            html.append('<div class="car-specs">')
            html.append('<h3>Car Details</h3>')
            html.append('<div class="small">')
            for k, v in (mobil.items() if isinstance(mobil, dict) else []):
                html.append(f'<div><strong>{k}:</strong> {v}</div>')
            html.append('</div>')
            html.append('</div>')

    # Total block
    html.append(f'<div class="total">Total Paid: Rp {getattr(transaksi, "total_bayar", "-")}</div>')

    html.append('<div class="footer">')
    html.append('<div>Showroom — Jl. Contoh No.1 — Contact: +62 812 3456 7890</div>')
    html.append('</div>')

    html.append('</div>')
    html.append('</body>')
    html.append('</html>')

    return '\n'.join(html)


def generate_pdf(html: str) -> bytes:
    """Generate PDF bytes from HTML using WeasyPrint. Raises RuntimeError if WeasyPrint not available.
    """
    if not WEASYPRINT_AVAILABLE:
        raise RuntimeError('WeasyPrint is not installed or not available. Install it to enable PDF generation.')
    try:
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except Exception as e:
        logger.exception('Failed to generate PDF: %s', str(e))
        raise
