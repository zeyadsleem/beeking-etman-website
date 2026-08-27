import "$lib/server/env";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { sendEmail } from "$lib/server/email";

// `building` guard: SvelteKit imports this module during the build step
// (postbuild analysis) with no env vars set, and better-auth refuses a
// default secret in production mode. env.ts validates the real values at
// runtime, so the fallbacks below only ever apply during the build.
// Passing `schema` keeps the adapter from touching `db._.fullSchema` at
// construction, so the lazily-resolved D1 driver is never forced early.
export const auth = betterAuth({
  baseURL: env.ORIGIN ?? (building ? "http://localhost:3000" : undefined),
  secret: env.BETTER_AUTH_SECRET ?? (building ? "build-time-secret-0123456789abcdef" : undefined),
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Password reset: send a reset link via Cloudflare Email Service.
    // Avoid awaiting the send to prevent timing attacks (Better Auth docs).
    sendResetPassword: async ({ user, url }, _request) => {
      const event = getRequestEvent();
      const platform = event?.platform;

      const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:#d97706;padding:20px 32px;text-align:center;">
  <h1 style="margin:0;color:#fff;font-size:22px;">مملكة النحل</h1>
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 12px;color:#92400e;font-size:18px;">إعادة تعيين كلمة المرور</h2>
  <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">
    مرحباً ${user.name || user.email}، تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك.
  </p>
  <p style="margin:0 0 20px;text-align:center;">
    <a href="${url}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      إعادة تعيين كلمة المرور
    </a>
  </p>
  <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
    إذا لم تطلب هذا، تجاهل هذا البريد. لن يُchanged أي شيء.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      const text = [
        "إعادة تعيين كلمة المرور — مملكة النحل",
        "",
        `مرحباً ${user.name || user.email}،`,
        "تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك.",
        "",
        `رابط إعادة التعيين: ${url}`,
        "",
        "إذا لم تطلب هذا، تجاهل هذا البريد.",
      ].join("\n");

      // Fire-and-forget: don't await to avoid timing-attack surface.
      void sendEmail(platform, {
        to: user.email,
        subject: "إعادة تعيين كلمة المرور — مملكة النحل",
        html,
        text,
      }).catch((err: unknown) => {
        console.error("[auth] password reset email failed", err);
      });
    },
  },
  plugins: [
    admin(),
    sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
  ],
});
