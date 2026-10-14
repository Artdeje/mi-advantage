const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || "";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`${EMAIL_API_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data?.error || "Email delivery failed." };
    }
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "Email service unreachable. Start it with: npm run email",
    };
  }
}

export function codeEmailTemplate(code: string, purpose: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#059669;margin:0 0 8px;">Mi Advantage</h2>
      <p style="color:#334155;font-size:14px;margin:0 0 16px;">${purpose}</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
        <span style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#065f46;font-family:monospace;">${code}</span>
      </div>
      <p style="color:#64748b;font-size:12px;margin:16px 0 0;">This code expires in 15 minutes. If you did not request it, ignore this email.</p>
    </div>
  `;
}

export function approvalEmailTemplate(shopName: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#059669;margin:0 0 8px;">Mi Advantage</h2>
      <p style="color:#334155;font-size:14px;">Congratulations! Your shop <b>${shopName}</b> has been approved by the administrator.</p>
      <p style="color:#334155;font-size:14px;">You can now sign in to your Partner Shop Dashboard and start processing member discounts.</p>
    </div>
  `;
}

export function rejectionEmailTemplate(shopName: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#059669;margin:0 0 8px;">Mi Advantage</h2>
      <p style="color:#334155;font-size:14px;">Your shop application for <b>${shopName}</b> was reviewed and could not be approved at this time.</p>
      <p style="color:#334155;font-size:14px;">Please contact the administrator for more information.</p>
    </div>
  `;
}
