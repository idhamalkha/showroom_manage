from decimal import Decimal, ROUND_HALF_UP

def calculate_sales_bonus(harga: float) -> dict:
    """
    Return percent (Decimal) and amount (Decimal) based on simple tiers.
    Tiers example:
      - < 300,000,000 : 1%
      - 300,000,000 - 499,999,999 : 1.5%
      - 500,000,000 - 999,999,999 : 2%
      - >= 1,000,000,000 : 2.5%
    """
    if harga is None:
        return {"percent": Decimal("0.0"), "amount": Decimal("0.0")}
    h = Decimal(str(harga))
    if h < Decimal("300000000"):
        pct = Decimal("0.01")
    elif h < Decimal("500000000"):
        pct = Decimal("0.015")
    elif h < Decimal("1000000000"):
        pct = Decimal("0.02")
    else:
        pct = Decimal("0.025")
    amount = (h * pct).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
    return {"percent": pct, "amount": amount}