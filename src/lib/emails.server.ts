// Server-only Resend helpers. Never import from client code.
const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Food Rescue Network <onboarding@resend.dev>";

function shell(title: string, intro: string, ctaUrl?: string, ctaLabel?: string, extra?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;color:#2d2d2d">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6dfd3">
        <tr><td style="padding:28px 32px;background:#4a6741;color:#fff;font-family:Georgia,serif;font-size:22px">Food Rescue Network</td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;color:#2d2d2d">${title}</h1>
          <p style="margin:0 0 20px;line-height:1.6;color:#5b5b5b">${intro}</p>
          ${extra ?? ""}
          ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#4a6741;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${ctaLabel ?? "Open"}</a>` : ""}
          <p style="margin:28px 0 0;font-size:12px;color:#8a8a8a">You're receiving this because of activity on your Food Rescue Network account.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not configured; skipping email", subject);
    return { skipped: true };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error", res.status, text.slice(0, 300));
      return { error: text };
    }
    return await res.json();
  } catch (e) {
    console.error("Resend exception", e);
    return { error: String(e) };
  }
}

export const templates = {
  donationCreated: (title: string, url: string) => ({
    subject: `Your donation "${title}" is live`,
    html: shell("Donation posted", `Your surplus food <strong>${title}</strong> is now visible to NGO partners and volunteers in your area.`, url, "View donation"),
  }),
  ngoAccepted: (title: string, ngoName: string, url: string) => ({
    subject: `${ngoName} accepted your donation`,
    html: shell("Great news!", `<strong>${ngoName}</strong> has accepted your donation <strong>${title}</strong> and will coordinate pickup.`, url, "See details"),
  }),
  volunteerAssigned: (title: string, url: string) => ({
    subject: `New pickup assigned: ${title}`,
    html: shell("You've been assigned a pickup", `A new rescue <strong>${title}</strong> has been assigned to you. Please review pickup details and confirm.`, url, "View assignment"),
  }),
  pickupConfirmed: (title: string, url: string) => ({
    subject: `Pickup confirmed: ${title}`,
    html: shell("Food picked up", `<strong>${title}</strong> has been picked up and is en route to the recipient.`, url, "Track delivery"),
  }),
  deliveryCompleted: (title: string, url: string) => ({
    subject: `Delivered: ${title}`,
    html: shell("Delivered — thank you!", `<strong>${title}</strong> has been successfully delivered. Thank you for closing the loop and reducing food waste.`, url, "View summary"),
  }),
};
