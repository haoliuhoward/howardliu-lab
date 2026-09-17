/*
  Netlify event function: runs automatically on every form submission
  (the file name `submission-created` is what binds it to the event).

  Sends a formatted HTML email for the `liu-lab-application` form via Resend,
  with a Markdown packet of the application attached (drop it in a folder
  for review). Other forms are ignored.

  Environment variables (Site configuration > Environment variables):
    RESEND_API_KEY            required — from https://resend.com/api-keys
    APPLICATION_NOTIFY_TO     optional — default haoliu.howard@gmail.com
    APPLICATION_NOTIFY_FROM   optional — default "Liu Lab Applications <onboarding@resend.dev>"
                              (onboarding@resend.dev can only deliver to the Resend
                              account owner's address; verify a domain to use your own)
*/

const FORM_NAME = "liu-lab-application";
const RED = "#EF525B";
const TEAL = "#00828B";
const SAND = "#EAE7D6";
const INK = "#2b2b2b";
const MUTED = "#6c6c6c";

const QUESTIONS = [
  ["q1", "Why are you interested in becoming a part of the Liu Lab? What do you hope to gain from the experience?"],
  ["q2", "After looking at the lab website, which research project is most interesting to you and why?"],
  ["q3", "What makes you tick, as it relates to the study of authoritarian politics, repression, or political conflict?"],
  ["q4", "What skills or experiences do you have that would make you a valuable part of the lab?"],
];

const COMMITMENTS = [
  ["confirm_meeting", "Can attend Tuesday 12:00–1:00 p.m. lab meeting"],
  ["confirm_hours", "Can commit 5–10 hours/week"],
  ["confirm_poli498", "Will enroll in 2 credits of POLI 498"],
  ["confirm_multiyear", "Interested in staying more than one semester"],
  ["interest_funding", "Wants help applying for Undergraduate Research Funds"],
  ["attest", "Attested accuracy / own writing"],
];

const DOCUMENTS = [
  ["cv", "Résumé / CV"],
  ["transcript", "Unofficial transcript"],
  ["writing_sample", "Writing sample"],
];

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const text = (v) => (v == null ? "" : String(v).trim());
const yes = (v) => text(v).toLowerCase() === "yes" || v === true;
const para = (s) => esc(s).replace(/\r?\n\r?\n/g, "</p><p>").replace(/\r?\n/g, "<br>");
const dash = (s) => (text(s) ? esc(s) : `<span style="color:${MUTED}">—</span>`);
const words = (s) => (text(s) ? text(s).split(/\s+/).length : 0);

function profiles(data) {
  const raw = data["profile[]"] ?? data.profile ?? [];
  return (Array.isArray(raw) ? raw : [raw]).map(text).filter(Boolean);
}

function fileInfo(v) {
  if (!v) return null;
  if (typeof v === "string") return v ? { url: v, filename: v.split("/").pop() } : null;
  if (typeof v === "object" && v.url) return { url: v.url, filename: v.filename || v.url.split("/").pop(), size: v.size };
  return null;
}

const kb = (n) => (n ? ` (${Math.round(n / 1024)} KB)` : "");

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function slug(s) {
  return text(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "applicant";
}

/* ---------- HTML email ---------- */

function sectionTitle(t) {
  return `<tr><td colspan="2" style="padding:26px 28px 8px;font:700 13px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${TEAL}">${t}</td></tr>`;
}

function row(label, value, opts = {}) {
  const val = opts.raw ? value : dash(value);
  return `<tr>
    <td style="padding:7px 0 7px 28px;width:170px;vertical-align:top;font:600 14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED}">${label}</td>
    <td style="padding:7px 28px 7px 12px;vertical-align:top;font:400 14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">${val}</td>
  </tr>`;
}

function check(ok, label) {
  const mark = ok
    ? `<span style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;background:${TEAL};color:#fff;font-size:12px;font-weight:700">&#10003;</span>`
    : `<span style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;background:#ddd;color:#888;font-size:12px">&#8211;</span>`;
  return `<tr><td colspan="2" style="padding:5px 28px;font:400 14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${ok ? INK : MUTED}">${mark}&nbsp;&nbsp;${label}</td></tr>`;
}

function buildHtml(p) {
  const d = p.data || {};
  const name = text(d.full_name) || "Unnamed applicant";
  const submitted = fmtDate(p.created_at);
  const adminUrl = `https://app.netlify.com/projects/lab-howardliu/forms/${p.form_id || ""}`;
  const prof = profiles(d);

  const answers = QUESTIONS.map(([k, q], i) => `
    <tr><td colspan="2" style="padding:18px 28px 0">
      <div style="font:700 14px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">
        <span style="color:${RED}">Q${i + 1}.</span> ${esc(q)}
        <span style="font-weight:400;color:${MUTED}"> · ${words(d[k])} words</span>
      </div>
      <div style="margin-top:8px;padding:14px 16px;background:#faf9f4;border-left:3px solid ${RED};border-radius:0 6px 6px 0;font:400 15px/1.6 Georgia,'Times New Roman',serif;color:${INK}">
        <p style="margin:0 0 10px">${text(d[k]) ? para(d[k]) : `<em style="color:${MUTED}">No answer</em>`}</p>
      </div>
    </td></tr>`).join("");

  const docs = DOCUMENTS.map(([k, label]) => {
    const f = fileInfo(d[k]);
    return row(label, f
      ? `<a href="${esc(f.url)}" style="color:${TEAL};font-weight:600">${esc(f.filename)}</a><span style="color:${MUTED}">${kb(f.size)}</span>`
      : `<span style="color:${MUTED}">not provided</span>`, { raw: true });
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Application: ${esc(name)}</title></head>
<body style="margin:0;padding:0;background:${SAND}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${SAND}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

  <tr><td style="background:${RED};padding:22px 28px">
    <div style="font:700 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.85)">Liu Research Lab · New application</div>
    <div style="margin-top:8px;font:700 26px/1.2 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#fff">${esc(name)}</div>
    <div style="margin-top:6px;font:400 14px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:rgba(255,255,255,.9)">
      ${esc(text(d.class_standing) || "—")} · ${esc(text(d.major) || "—")} · applying for <strong>${esc(text(d.semester) || "—")}</strong>
    </div>
  </td></tr>

  <tr><td style="padding:0 28px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0"><tr>
      ${[["GPA", text(d.gpa) || "—"], ["Graduation", text(d.graduation) || "—"], ["R", (text(d.skill_r) || "None").split(" (")[0]], ["Python", (text(d.skill_python) || "None").split(" (")[0]]]
        .map(([k, v]) => `<td width="25%" style="padding:12px 8px;text-align:center;background:#faf9f4;border-radius:6px;border:1px solid #eee">
          <div style="font:600 11px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">${k}</div>
          <div style="margin-top:6px;font:700 17px/1.2 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">${esc(v)}</div></td>`).join('<td width="8"></td>')}
    </tr></table>
  </td></tr>

  <tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    ${sectionTitle("Contact")}
    ${row("Email", `<a href="mailto:${esc(d.email)}" style="color:${TEAL}">${esc(d.email)}</a>`, { raw: true })}
    ${row("Phone", d.phone)}
    ${row("Preferred name", d.preferred_name)}
    ${row("Minor", d.minor)}
    ${row("Heard about lab", d.referral)}

    ${sectionTitle("Background & skills")}
    ${row("Coursework", text(d.coursework) ? para(d.coursework) : "", { raw: text(d.coursework) !== "" })}
    ${row("R", d.skill_r)}
    ${row("Python", d.skill_python)}
    ${row("Other tools", d.skill_other)}
    ${row("Languages", d.languages)}
    ${row("Region experience", d.region_experience)}
    ${row("Self-described type", prof.length ? prof.map((x) => `<span style="display:inline-block;margin:0 6px 4px 0;padding:3px 10px;border-radius:12px;background:${TEAL};color:#fff;font-size:12px;font-weight:600">${esc(x)}</span>`).join("") : "", { raw: prof.length > 0 })}

    ${sectionTitle("Commitment")}
    ${COMMITMENTS.map(([k, label]) => check(yes(d[k]), label)).join("")}
    ${text(d.other_commitments) ? row("Other commitments", d.other_commitments) : ""}

    ${sectionTitle("Short answers")}
    ${answers}

    ${sectionTitle("Documents")}
    ${docs}
    <tr><td colspan="2" style="height:20px"></td></tr>
  </table></td></tr>

  <tr><td style="padding:16px 28px;background:#faf9f4;border-top:1px solid #eee;font:400 12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED}">
    Submitted ${esc(submitted)} (Eastern) · Submission #${esc(p.number ?? "")} ·
    <a href="${esc(adminUrl)}" style="color:${TEAL}">View in Netlify</a><br>
    A Markdown copy of this application is attached. Reply to this email to write to the applicant directly.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* ---------- Markdown packet (attachment) ---------- */

function buildMarkdown(p) {
  const d = p.data || {};
  const line = (label, v) => `- **${label}:** ${text(v) || "—"}`;
  const out = [];
  out.push(`# Application: ${text(d.full_name) || "Unnamed applicant"}`);
  out.push("");
  out.push(`*Liu Research Lab · submitted ${fmtDate(p.created_at)} (Eastern) · Netlify submission #${p.number ?? ""}*`);
  out.push("");
  out.push("## Applicant");
  out.push(line("Full name", d.full_name));
  out.push(line("Preferred name / pronouns", d.preferred_name));
  out.push(line("Email", d.email));
  out.push(line("Phone", d.phone));
  out.push(line("Major(s)", d.major));
  out.push(line("Minor(s)", d.minor));
  out.push(line("Class standing", d.class_standing));
  out.push(line("Expected graduation", d.graduation));
  out.push(line("GPA", d.gpa));
  out.push(line("Semester applying for", d.semester));
  out.push(line("Heard about the lab", d.referral));
  out.push("");
  out.push("## Background & skills");
  out.push(line("Relevant coursework", text(d.coursework).replace(/\r?\n/g, " / ")));
  out.push(line("R", d.skill_r));
  out.push(line("Python", d.skill_python));
  out.push(line("Other tools", d.skill_other));
  out.push(line("Languages", d.languages));
  out.push(line("Region experience", d.region_experience));
  out.push(line("Self-described type", profiles(d).join(", ")));
  out.push("");
  out.push("## Commitment");
  for (const [k, label] of COMMITMENTS) out.push(`- [${yes(d[k]) ? "x" : " "}] ${label}`);
  if (text(d.other_commitments)) out.push(line("Other commitments", d.other_commitments));
  out.push("");
  out.push("## Short answers");
  QUESTIONS.forEach(([k, q], i) => {
    out.push("");
    out.push(`### Q${i + 1}. ${q}`);
    out.push("");
    out.push(`*${words(d[k])} words*`);
    out.push("");
    out.push(text(d[k]) || "_No answer_");
  });
  out.push("");
  out.push("## Documents");
  for (const [k, label] of DOCUMENTS) {
    const f = fileInfo(d[k]);
    out.push(f ? `- **${label}:** [${f.filename}](${f.url})` : `- **${label}:** not provided`);
  }
  out.push("");
  return out.join("\n");
}

function attachmentName(p) {
  const d = p.data || {};
  const date = (p.created_at || new Date().toISOString()).slice(0, 10);
  return `${date}_${slug(d.full_name)}_liu-lab-application.md`;
}

/* ---------- send ---------- */

export function render(payload) {
  return { html: buildHtml(payload), markdown: buildMarkdown(payload), filename: attachmentName(payload) };
}

export async function sendEmail(payload, env = process.env) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const to = env.APPLICATION_NOTIFY_TO || "haoliu.howard@gmail.com";
  const from = env.APPLICATION_NOTIFY_FROM || "Liu Lab Applications <onboarding@resend.dev>";
  const d = payload.data || {};
  const { html, markdown, filename } = render(payload);

  const body = {
    from,
    to: to.split(",").map((s) => s.trim()).filter(Boolean),
    reply_to: text(d.email) || undefined,
    subject: `Lab application: ${text(d.full_name) || "Unnamed"} — ${text(d.semester) || "semester not given"}`,
    html,
    text: markdown,
    attachments: [{ filename, content: Buffer.from(markdown, "utf8").toString("base64") }],
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export const handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}").payload;
  } catch (e) {
    return { statusCode: 400, body: "bad payload" };
  }
  if (!payload || payload.form_name !== FORM_NAME) {
    return { statusCode: 200, body: `ignored form ${payload?.form_name}` };
  }
  try {
    const r = await sendEmail(payload);
    console.log(`application email sent for ${payload.data?.full_name}: ${r.id}`);
    return { statusCode: 200, body: "sent" };
  } catch (e) {
    // The submission is already stored in Netlify Forms; only the email failed.
    console.error("application email failed:", e.message);
    return { statusCode: 500, body: e.message };
  }
};
