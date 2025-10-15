import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendSubmissionEmails(opts: {
  toUser?: string | null;
  toAdmin?: string | null;
  payload: {
    store: string | null;
    user_email: string | null;
    section_total: number;
    adt: number | null;
    extreme_lates: number | null;
    sbr: number | null;
    service_total: number;
    predicted: number;
    id: string;
    created_at?: string;
  };
}) {
  if (!resend) return;

  const { toUser, toAdmin, payload } = opts;
  const subject = `Mourne-oids OER Walkthrough — ${payload.store ?? "Unknown store"} (${payload.predicted}/100)`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif">
      <h2>Mourne-oids OER Walkthrough</h2>
      <p><strong>Store:</strong> ${payload.store ?? "-"}<br/>
         <strong>Submitted by:</strong> ${payload.user_email ?? "-"}<br/>
         <strong>Predicted OER:</strong> ${payload.predicted}/100<br/>
         <strong>Walkthrough:</strong> ${payload.section_total}/75<br/>
         <strong>Service:</strong> ${payload.service_total}/25
         <br/>ADT: ${payload.adt ?? "-"} | X-Lates%: ${payload.extreme_lates ?? "-"} | SBR%: ${payload.sbr ?? "-"}
      </p>
      <p style="font-size:12px;opacity:.7">Submission ID: ${payload.id}</p>
    </div>
  `;

  const sends: Promise<any>[] = [];
  if (toUser) sends.push(resend.emails.send({ from: "Mourne-oids <no-reply@resend.dev>", to: toUser, subject, html }));
  if (toAdmin) sends.push(resend.emails.send({ from: "Mourne-oids <no-reply@resend.dev>", to: toAdmin, subject, html }));
  await Promise.allSettled(sends);
}
