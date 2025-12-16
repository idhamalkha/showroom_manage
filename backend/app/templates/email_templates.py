"""
Email templates untuk berbagai notifikasi cicilan.
Template menggunakan HTML dengan styling inline untuk compatibility.
"""
from typing import Optional


class EmailTemplates:
    """Email templates untuk komunikasi dengan customer."""

    @staticmethod
    def get_overdue_reminder(
        customer_name: str,
        kd_schedule: int,
        amount: float,
        due_date: str,
        days_overdue: int,
        admin_phone: str = "62-123-456-7890",
        admin_email: str = "finance@showroom.com"
    ) -> tuple:
        """
        Template untuk reminder pembayaran yang sudah jatuh tempo.

        Returns:
            (subject, body)
        """
        subject = f"⚠️ Pengingat Pembayaran Cicilan - {days_overdue} hari keterlambatan"

        body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }}
                .content {{ background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
                .alert {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 3px; }}
                .info-box {{ background-color: #f0f8ff; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; border-radius: 3px; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #d32f2f; margin: 10px 0; }}
                .button {{ display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }}
                .footer {{ text-align: center; font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }}
                .overdue-badge {{ display: inline-block; background-color: #d32f2f; color: white; padding: 5px 10px; border-radius: 3px; font-size: 14px; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>⚠️ PENGINGAT PEMBAYARAN CICILAN</h2>
                </div>

                <div class="content">
                    <p>Yth. <strong>{customer_name}</strong>,</p>

                    <div class="alert">
                        <p><strong>Pembayaran cicilan Anda sudah <span class="overdue-badge">{days_overdue} HARI TERLAMBAT</span></strong></p>
                    </div>

                    <div class="info-box">
                        <h3>📋 Detail Cicilan:</h3>
                        <p><strong>Nomor Jadwal:</strong> {kd_schedule}</p>
                        <p><strong>Jumlah Pembayaran:</strong></p>
                        <p class="amount">Rp {amount:,.0f}</p>
                        <p><strong>Tanggal Jatuh Tempo:</strong> {due_date}</p>
                        <p><strong>Status:</strong> <span style="color: #d32f2f; font-weight: bold;">TERLAMBAT</span></p>
                    </div>

                    <h3>📌 Tindakan Segera Diperlukan:</h3>
                    <p>Mohon untuk segera melakukan pembayaran untuk menghindari penindakan lebih lanjut. Anda dapat:</p>
                    <ul>
                        <li>Menghubungi tim finance kami</li>
                        <li>Melakukan transfer ke rekening yang telah disediakan</li>
                        <li>Datang langsung ke kantor kami</li>
                    </ul>

                    <h3>📞 Hubungi Kami:</h3>
                    <p>
                        <strong>Admin Finance:</strong><br>
                        📱 {admin_phone}<br>
                        📧 {admin_email}
                    </p>

                    <p style="color: #d32f2f; font-weight: bold;">
                        ⚠️ Jika pembayaran tidak dilakukan dalam 7 hari, kami akan melakukan eskalasi kasus.
                    </p>
                </div>

                <div class="footer">
                    <p>Email ini dikirim oleh sistem otomatis. Mohon tidak membalas email ini.</p>
                    <p>© 2024 Showroom Finance. Semua hak dilindungi.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return subject, body

    @staticmethod
    def get_payment_confirmation(
        customer_name: str,
        kd_schedule: int,
        amount: float,
        payment_date: str,
        remaining_balance: Optional[float] = None
    ) -> tuple:
        """
        Template untuk konfirmasi pembayaran diterima.

        Returns:
            (subject, body)
        """
        subject = f"✅ Pembayaran Diterima - Cicilan {kd_schedule}"

        remaining_text = ""
        if remaining_balance is not None:
            remaining_text = f"""
            <p><strong>Saldo Sisa:</strong> <span style="color: #4CAF50; font-size: 18px; font-weight: bold;">Rp {remaining_balance:,.0f}</span></p>
            """

        body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }}
                .content {{ background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
                .success-badge {{ background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 15px 0; }}
                .info-box {{ background-color: #f0f8ff; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; border-radius: 3px; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #4CAF50; margin: 10px 0; }}
                .footer {{ text-align: center; font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>✅ PEMBAYARAN BERHASIL</h2>
                </div>

                <div class="content">
                    <p>Yth. <strong>{customer_name}</strong>,</p>

                    <div class="success-badge">
                        <h3 style="margin: 0;">Pembayaran Anda Telah Diterima!</h3>
                    </div>

                    <div class="info-box">
                        <h3>📋 Detail Pembayaran:</h3>
                        <p><strong>Nomor Jadwal:</strong> {kd_schedule}</p>
                        <p><strong>Jumlah Pembayaran:</strong></p>
                        <p class="amount">Rp {amount:,.0f}</p>
                        <p><strong>Tanggal Pembayaran:</strong> {payment_date}</p>
                        <p><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">✅ BERHASIL</span></p>
                        {remaining_text}
                    </div>

                    <p>Terima kasih atas pembayaran tepat waktu Anda. Status cicilan Anda telah diperbarui di sistem.</p>

                    <p style="background-color: #f0f8ff; padding: 10px; border-left: 4px solid #2196F3; border-radius: 3px;">
                        Anda dapat melihat detail lengkap cicilan Anda melalui portal pelanggan kami.
                    </p>
                </div>

                <div class="footer">
                    <p>Email ini dikirim oleh sistem otomatis. Terima kasih telah menjadi pelanggan setia kami.</p>
                    <p>© 2024 Showroom Finance. Semua hak dilindungi.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return subject, body

    @staticmethod
    def get_early_notice(
        customer_name: str,
        kd_schedule: int,
        amount: float,
        due_date: str,
        days_until_due: int
    ) -> tuple:
        """
        Template untuk notifikasi pembayaran yang akan jatuh tempo.

        Returns:
            (subject, body)
        """
        subject = f"📅 Pengingat: Pembayaran Cicilan Jatuh Tempo {days_until_due} Hari Lagi"

        body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background: linear-gradient(135deg, #2196F3 0%, #1565C0 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }}
                .content {{ background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
                .reminder-box {{ background-color: #E3F2FD; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; border-radius: 3px; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #1565C0; margin: 10px 0; }}
                .footer {{ text-align: center; font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📅 PENGINGAT PEMBAYARAN</h2>
                </div>

                <div class="content">
                    <p>Yth. <strong>{customer_name}</strong>,</p>

                    <div class="reminder-box">
                        <h3 style="margin-top: 0;">Pembayaran cicilan Anda akan jatuh tempo dalam <strong>{days_until_due} hari</strong></h3>
                        <p style="margin: 10px 0; font-size: 14px;">Persiapkan dana Anda agar tidak terjadi keterlambatan pembayaran.</p>
                    </div>

                    <h3>📋 Detail Cicilan:</h3>
                    <p><strong>Nomor Jadwal:</strong> {kd_schedule}</p>
                    <p><strong>Jumlah Pembayaran:</strong></p>
                    <p class="amount">Rp {amount:,.0f}</p>
                    <p><strong>Jatuh Tempo:</strong> <span style="font-weight: bold; color: #2196F3;">{due_date}</span></p>

                    <h3>💡 Tip:</h3>
                    <ul>
                        <li>Lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari keterlambatan</li>
                        <li>Siapkan bukti transfer untuk arsip Anda</li>
                        <li>Hubungi kami jika ada kendala pembayaran</li>
                    </ul>
                </div>

                <div class="footer">
                    <p>Email ini dikirim oleh sistem otomatis untuk membantu Anda mengelola pembayaran.</p>
                    <p>© 2024 Showroom Finance. Semua hak dilindungi.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return subject, body

    @staticmethod
    def get_final_notice(
        customer_name: str,
        kd_schedule: int,
        amount: float,
        days_overdue: int,
        escalation_action: str = "pengambilan kendaraan"
    ) -> tuple:
        """
        Template untuk notifikasi akhir sebelum eskalasi.

        Returns:
            (subject, body)
        """
        subject = f"🚨 PEMBERITAHUAN FINAL - Tindakan Hukum Akan Diambil"

        body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
                .header {{ background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }}
                .content {{ background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
                .danger-box {{ background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0; border-radius: 3px; }}
                .important {{ background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; border-radius: 3px; color: #e65100; font-weight: bold; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #d32f2f; margin: 10px 0; }}
                .footer {{ text-align: center; font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🚨 PEMBERITAHUAN FINAL</h2>
                </div>

                <div class="content">
                    <p>Yth. <strong>{customer_name}</strong>,</p>

                    <div class="danger-box">
                        <p style="margin: 0; font-size: 16px; font-weight: bold;">
                            ⚠️ PEMBAYARAN ANDA TELAH TERLAMBAT {days_overdue} HARI
                        </p>
                    </div>

                    <h3 style="color: #d32f2f;">📌 TINDAKAN HUKUM AKAN SEGERA DIAMBIL</h3>

                    <div class="important">
                        <p>Jika pembayaran tidak diterima dalam 48 JAM ke depan, kami akan melakukan:</p>
                        <ul style="margin: 10px 0;">
                            <li>📞 Kontak keluarga/kantor Anda</li>
                            <li>🏛️ Pelaporan ke instansi terkait</li>
                            <li>🚘 {escalation_action.upper()}</li>
                        </ul>
                    </div>

                    <h3>💰 Informasi Pembayaran:</h3>
                    <p><strong>Nomor Jadwal:</strong> {kd_schedule}</p>
                    <p><strong>Jumlah Tagihan:</strong></p>
                    <p class="amount">Rp {amount:,.0f}</p>
                    <p style="color: #d32f2f; font-weight: bold;">Status: ⚠️ SANGAT MENDESAK</p>

                    <h3>🔔 Hubungi Kami Sekarang:</h3>
                    <p>Silakan hubungi departemen finance kami segera untuk menyelesaikan masalah ini:</p>
                    <p>
                        <strong>📱 Hubungi Nomor Layanan:</strong> 62-123-456-7890<br>
                        <strong>📧 Email:</strong> finance@showroom.com<br>
                        <strong>🏢 Kantor:</strong> Jl. Example No. 123, Kota
                    </p>

                    <p style="background-color: #ffebee; padding: 10px; border-left: 4px solid #d32f2f; border-radius: 3px; color: #b71c1c;">
                        <strong>JANGAN ABAIKAN PEMBERITAHUAN INI!</strong><br>
                        Anda masih memiliki kesempatan untuk menyelesaikan ini dengan damai. Hubungi kami segera.
                    </p>
                </div>

                <div class="footer">
                    <p>Email ini merupakan pemberitahuan resmi dari sistem koleksi kami.</p>
                    <p>© 2024 Showroom Finance. Semua hak dilindungi.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return subject, body


# Convenience functions
def get_email_template(template_type: str, **kwargs) -> tuple:
    """
    Get email template by type.

    Args:
        template_type: 'overdue_reminder', 'payment_confirmation', 'early_notice', 'final_notice'
        **kwargs: Arguments sesuai template type

    Returns:
        (subject, body)
    """
    templates = {
        'overdue_reminder': EmailTemplates.get_overdue_reminder,
        'payment_confirmation': EmailTemplates.get_payment_confirmation,
        'early_notice': EmailTemplates.get_early_notice,
        'final_notice': EmailTemplates.get_final_notice,
    }

    if template_type not in templates:
        raise ValueError(f"Unknown template type: {template_type}")

    return templates[template_type](**kwargs)
