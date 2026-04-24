// ============================================================
// GOOGLE APPS SCRIPT BACKEND FOR TSHK RESULTS SYSTEM
// ============================================================

// 1. Create a Google Sheet.
// 2. Add sheets named: Writers, Marksheet, Sessions, AuditLog.
// 3. Paste this code in Apps Script.
// 4. Deploy as Web App.
// 5. Copy Web App URL into script.js API_URL.

const ADMIN_PASSWORD = "change_admin_password";
const MARKER_PASSWORD = "change_marker_password";
const EMAIL_BATCH_SIZE = 50;
const PASS_MARK_SERVANT = 60;
const PASS_MARK_NON_SERVANT = 50;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;
    if (action === "adminLogin") result = { ok: data.password === ADMIN_PASSWORD };
    else if (action === "markerLogin") result = { ok: data.password === MARKER_PASSWORD };
    else if (action === "validateSession") result = validateSession(data);
    else if (action === "registerWriter") result = registerWriter(data);
    else if (action === "getStats") result = getStats(data);
    else if (action === "generateSessionCode") result = generateSessionCode(data);
    else if (action === "findWriter") result = findWriter(data);
    else if (action === "saveMark") result = saveMark(data);
    else if (action === "findMark") result = findMark(data);
    else if (action === "updateMark") result = updateMark(data);
    else if (action === "deleteMark") result = deleteMark(data);
    else if (action === "updateWriter") result = updateWriter(data);
    else if (action === "deleteWriter") result = deleteWriter(data);
    else if (action === "resendEmail") result = resendEmail(data);
    else if (action === "sendPendingBatch") result = sendPendingBatch();
    else if (action === "auditLogs") result = auditLogs(data);
    else result = { ok: false, message: "Unknown action." };

    return output(result);
  } catch (err) {
    return output({ ok: false, message: err.toString() });
  }
}

function output(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sh(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

function rows(name) {
  const sheet = sh(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => o[h] = r[j]);
    return o;
  });
}

function append(name, obj) {
  const sheet = sh(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(h => obj[h] || ""));
}

function updateRow(name, rowNumber, obj) {
  const sheet = sh(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (obj[h] !== undefined) sheet.getRange(rowNumber, i + 1).setValue(obj[h]);
  });
}

function logAction(role, action, membership, details) {
  append("AuditLog", {
    timestamp: new Date(),
    role,
    action,
    membership_number: membership || "",
    details: details || "",
  });
}

function validateSession(data) {
  const code = String(data.code || "").trim().toUpperCase();
  const found = rows("Sessions").reverse().find(r =>
    String(r.session_code).toUpperCase() === code && String(r.active).toUpperCase() === "YES"
  );
  if (!found) return { ok: false, message: "Invalid or inactive session code." };
  return { ok: true, session: found };
}

function registerWriter(data) {
  const session = validateSession({ code: data.session_code });
  if (!session.ok) return session;

  const exists = rows("Writers").some(r =>
    String(r.membership_number).trim() === String(data.membership_number).trim()
  );
  if (exists) return { ok: false, message: "This membership number already exists." };

  append("Writers", {
    created_at: new Date(),
    session_date: session.session.session_date,
    session_day: session.session.session_day,
    session_time: session.session.session_time,
    session_code: data.session_code,
    name: data.name,
    surname: data.surname,
    email: data.email,
    cellphone_number: data.cellphone_number,
    membership_number: data.membership_number,
    state: data.state,
    spiritual_centre: data.spiritual_centre,
    year_started_ekhayeni: data.year_started_ekhayeni,
    date_of_imhlabuluko: data.date_of_imhlabuluko,
    servant: data.servant,
    servant_type: data.servant_type || "",
  });

  logAction("Writer", "REGISTERED", data.membership_number, `${data.name} ${data.surname} registered.`);
  return { ok: true, message: "Registered successfully." };
}

function resultFor(servant, mark) {
  mark = Number(mark);
  if (String(servant).toLowerCase() === "yes") return mark < PASS_MARK_SERVANT ? "FAIL" : "PASS";
  return mark < PASS_MARK_NON_SERVANT ? "FAIL" : "PASS";
}

function getStats(data) {
  const dateFilter = data.date || "";
  let writers = rows("Writers");
  let marks = rows("Marksheet");

  if (dateFilter) {
    writers = writers.filter(w => String(w.session_date).slice(0,10) === dateFilter);
    const members = writers.map(w => String(w.membership_number));
    marks = marks.filter(m => members.includes(String(m.membership_number)));
  }

  return {
    ok: true,
    stats: {
      registered: writers.length,
      marked: marks.filter(m => String(m.mark) !== "").length,
      passed: marks.filter(m => String(m.result).toUpperCase() === "PASS").length,
      failed: marks.filter(m => String(m.result).toUpperCase() === "FAIL").length,
      unsent: marks.filter(m => String(m.mark) !== "" && String(m.email_sent).toUpperCase() !== "YES").length,
    }
  };
}

function generateSessionCode(data) {
  if (!data.date || !data.time) return { ok: false, message: "Select date and time." };
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const d = new Date(data.date + "T00:00:00");
  const day = Utilities.formatDate(d, Session.getScriptTimeZone(), "EEEE");

  append("Sessions", {
    created_at: new Date(),
    session_date: data.date,
    session_day: day,
    session_time: data.time,
    session_code: code,
    active: "YES",
  });

  logAction("Admin", "GENERATED_SESSION_CODE", "", `${day} ${data.date} ${data.time} Code=${code}`);
  return { ok: true, code };
}

function findWriter(data) {
  const found = rows("Writers").find(r => String(r.membership_number).trim() === String(data.membership_number).trim());
  if (!found) return { ok: false, message: "No writer found." };
  return { ok: true, writer: found };
}

function saveMark(data) {
  const writerRes = findWriter(data);
  if (!writerRes.ok) return writerRes;

  const already = rows("Marksheet").some(r => String(r.membership_number).trim() === String(data.membership_number).trim());
  if (already) return { ok: false, message: "This writer already has a mark." };

  const w = writerRes.writer;
  const result = resultFor(w.servant, data.mark);

  append("Marksheet", {
    marked_at: new Date(),
    name: w.name,
    surname: w.surname,
    email: w.email,
    cellphone_number: w.cellphone_number,
    membership_number: w.membership_number,
    servant: w.servant,
    servant_type: w.servant_type,
    mark: data.mark,
    result,
    email_sent: "NO",
    email_sent_at: "",
  });

  logAction("Marker", "SAVED_MARK", w.membership_number, `Mark=${data.mark}, Result=${result}`);
  sendPendingBatch();
  return { ok: true, result };
}

function findMark(data) {
  const found = rows("Marksheet").find(r => String(r.membership_number).trim() === String(data.membership_number).trim());
  if (!found) return { ok: false, message: "No mark found." };
  return { ok: true, mark: found };
}

function updateMark(data) {
  const res = findMark(data);
  if (!res.ok) return res;
  const newResult = resultFor(res.mark.servant, data.mark);

  updateRow("Marksheet", res.mark._row, {
    mark: data.mark,
    result: newResult,
    email_sent: "NO",
    email_sent_at: "",
  });

  logAction("Admin", "UPDATED_MARK_REMARK", data.membership_number, `New mark=${data.mark}, result=${newResult}, email reset.`);
  return { ok: true, message: `Mark updated. New result: ${newResult}` };
}

function deleteMark(data) {
  const res = findMark(data);
  if (!res.ok) return res;
  sh("Marksheet").deleteRow(res.mark._row);
  logAction("Admin", "DELETED_MARK", data.membership_number, "Mark deleted.");
  return { ok: true, message: "Mark deleted." };
}

function updateWriter(data) {
  const res = findWriter(data);
  if (!res.ok) return res;
  updateRow("Writers", res.writer._row, data);
  logAction("Admin", "UPDATED_WRITER", data.membership_number, "Writer details updated.");
  return { ok: true, message: "Writer updated." };
}

function deleteWriter(data) {
  const res = findWriter(data);
  if (!res.ok) return res;
  sh("Writers").deleteRow(res.writer._row);
  logAction("Admin", "DELETED_WRITER", data.membership_number, "Writer deleted.");
  return { ok: true, message: "Writer deleted." };
}

function resultEmail(row) {
  const pass = String(row.result).toUpperCase() === "PASS";
  const message = pass
    ? "You have successfully passed Phase 1 of the assessment and hereby accepted to proceed to the next phase of interviews."
    : "We regrettably inform you that you did not make it in the phase 1 of the assessment for the Spiritual Kingdom, you may follow the processes to write a test for the Institution.";

  return `
  <div style="background:#fff3df;padding:25px;font-family:Arial">
    <div style="max-width:760px;margin:auto;background:white;border-radius:18px;overflow:hidden;border:1px solid #ddd">
      <div style="background:linear-gradient(135deg,#4a0012,#800020,#b45309);color:white;text-align:center;padding:26px">
        <h1>The Spiritual Home Kingdom</h1>
        <p>Ekuphumuleni Spiritual Pilgrimage</p>
      </div>
      <div style="padding:28px">
        <p>Dear <b>${row.name} ${row.surname}</b>,</p>
        <h2 style="color:${pass ? '#047857' : '#b91c1c'}">${pass ? 'Congratulations!' : 'We regret to inform you...'}</h2>
        <p>${message}</p>
        <div style="background:${pass ? '#ecfdf5' : '#fef2f2'};padding:18px;border-radius:16px;text-align:center">
          <div>Final Result</div>
          <h1>${row.result}</h1>
        </div>
        <p><b>Membership Number:</b> ${row.membership_number}</p>
        <p><b>Mark:</b> ${row.mark}/90</p>
        <p>Kind regards,<br><b>The Spiritual Home Kingdom</b></p>
        <p style="text-align:center;color:#7c3f16">Rooted in Spirit • Guided by the Divine • Driven by Purpose</p>
      </div>
    </div>
  </div>`;
}

function resendEmail(data) {
  const res = findMark(data);
  if (!res.ok) return res;

  GmailApp.sendEmail(
    res.mark.email,
    "The Spiritual Home Kingdom Test Results",
    "",
    { htmlBody: resultEmail(res.mark) }
  );

  updateRow("Marksheet", res.mark._row, {
    email_sent: "YES",
    email_sent_at: new Date(),
  });

  logAction("Admin", "RESENT_EMAIL", data.membership_number, `Email sent to ${res.mark.email}`);
  return { ok: true, message: "Email resent successfully." };
}

function sendPendingBatch() {
  const unsent = rows("Marksheet").filter(r =>
    String(r.email_sent).toUpperCase() !== "YES" && String(r.mark) !== ""
  ).slice(0, EMAIL_BATCH_SIZE);

  if (unsent.length < EMAIL_BATCH_SIZE) {
    return { ok: true, message: `${unsent.length} unsent records. Emails send when this reaches ${EMAIL_BATCH_SIZE}.` };
  }

  unsent.forEach(r => {
    GmailApp.sendEmail(
      r.email,
      "The Spiritual Home Kingdom Test Results",
      "",
      { htmlBody: resultEmail(r) }
    );
    updateRow("Marksheet", r._row, {
      email_sent: "YES",
      email_sent_at: new Date(),
    });
    logAction("System", "EMAIL_SENT", r.membership_number, `Email sent to ${r.email}`);
  });

  return { ok: true, message: `Sent ${unsent.length} emails.` };
}

function auditLogs(data) {
  let logs = rows("AuditLog").reverse();
  const search = String(data.search || "").toLowerCase();
  if (search) {
    logs = logs.filter(r => JSON.stringify(r).toLowerCase().includes(search));
  }
  return { ok: true, logs: logs.slice(0, 200) };
}
