package mailer

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/teymurovtural/ttshelf-backend/internal/config"
)

type Mailer struct {
	cfg *config.SMTPConfig
}

func New(cfg *config.SMTPConfig) *Mailer {
	return &Mailer{cfg: cfg}
}

func (m *Mailer) SendOTP(toEmail, toName, otp string) error {
	subject := "TTShelf — Email Təsdiq Kodu"
	body := buildOTPEmail(toName, otp)
	return m.send(toEmail, subject, body)
}

func (m *Mailer) send(to, subject, htmlBody string) error {
	from := fmt.Sprintf("%s <%s>", m.cfg.FromName, m.cfg.From)
	addr := fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.Port)

	headers := map[string]string{
		"From":         from,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": "text/html; charset=UTF-8",
	}

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)

	// Port 465 → SSL/TLS, 587 → STARTTLS
	if m.cfg.Port == 465 {
		tlsCfg := &tls.Config{ServerName: m.cfg.Host}
		conn, err := tls.Dial("tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("tls dial: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, m.cfg.Host)
		if err != nil {
			return fmt.Errorf("smtp client: %w", err)
		}
		defer client.Quit()

		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
		if err = client.Mail(m.cfg.From); err != nil {
			return fmt.Errorf("smtp mail: %w", err)
		}
		if err = client.Rcpt(to); err != nil {
			return fmt.Errorf("smtp rcpt: %w", err)
		}
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("smtp data: %w", err)
		}
		_, err = w.Write([]byte(msg.String()))
		if err != nil {
			return fmt.Errorf("smtp write: %w", err)
		}
		return w.Close()
	}

	// STARTTLS (port 587)
	return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, []byte(msg.String()))
}

func buildOTPEmail(name, otp string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#4f46e5;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">TTShelf</h1>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">Personal Knowledge Management</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 6px;color:#64748b;font-size:14px;">Salam, <strong style="color:#1e293b;">%s</strong></p>
          <h2 style="margin:0 0 20px;color:#1e293b;font-size:18px;font-weight:600;">Email ünvanınızı təsdiq edin</h2>
          <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.6;">
            Aşağıdakı 6 rəqəmli kodu daxil edin. Kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
          </p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:38px;font-weight:700;letter-spacing:10px;color:#4f46e5;font-family:'Courier New',monospace;">%s</span>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
            Bu kodu siz tələb etməmisinizsə, bu emaili nəzərə almayın. Hesabınız təhlükəsizdir.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">© 2025 TTShelf. Bütün hüquqlar qorunur.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, otp)
}
