/**
 * Transactional email for one-time codes. Table layout + inline styles because email clients (Gmail, Outlook)
 * ignore most CSS. Colours match the app theme (rose accent #E31C5F, ink #222222).
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const FONT = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function codeEmail(p: { name: string; email: string; code: string; heading: string; intro: string; ttlMin: number }) {
  const first = esc(p.name.split(' ')[0] ?? p.name);
  const digits = p.code
    .split('')
    .map(
      (d) =>
        `<td style="width:38px;height:52px;border:1px solid #EBEBEB;border-radius:10px;background:#F7F7F7;font:700 24px/52px ${FONT};color:#222222;text-align:center">${d}</td>`,
    )
    .join('<td style="width:6px"></td>');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(p.heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F7F7F7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${p.code} is your code. It expires in ${p.ttlMin} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="padding:0 4px 20px;font:700 13px/1 ${FONT};letter-spacing:4px;color:#222222">
      LANDCONNECT<span style="color:#E31C5F">.</span>
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #EBEBEB;border-radius:16px;padding:32px 28px">
      <h1 style="margin:0 0 8px;font:700 22px/1.3 ${FONT};color:#222222">${esc(p.heading)}</h1>
      <p style="margin:0 0 24px;font:400 15px/1.6 ${FONT};color:#484848">Hi ${first}, ${esc(p.intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>${digits}</tr></table>
      <p style="margin:16px 0 0;font:600 13px/1.5 ${FONT};color:#6A6A6A;text-align:center">Expires in ${p.ttlMin} minutes</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #EBEBEB">
        <tr><td style="padding-top:20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F4;border-radius:12px">
            <tr><td style="padding:14px 16px;font:400 13px/1.55 ${FONT};color:#484848">
              <strong style="color:#222222">Keep this code to yourself.</strong> LandConnect will never ask for it on a call, in chat or by email.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 8px 0;font:400 12px/1.6 ${FONT};color:#6A6A6A;text-align:center">
      Sent to ${esc(p.email)} because this address was entered in LandConnect.<br>
      If that wasn't you, ignore this email and nothing will change.<br><br>
      <span style="color:#222222;font-weight:600">LandConnect</span> · Buy and sell land, privately. Phone numbers stay hidden.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Hi ${p.name.split(' ')[0]},

${p.intro.charAt(0).toUpperCase()}${p.intro.slice(1)}

    ${p.code}

It expires in ${p.ttlMin} minutes. Keep it to yourself: LandConnect will never ask for it on a call, in chat or by email.

If you didn't ask for this, ignore this email and nothing will change.
`;
  return { html, text };
}
