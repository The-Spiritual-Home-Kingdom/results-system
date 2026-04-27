// ============================================================
// CONFIG - paste your Google Apps Script Web App URL here
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwcCgqbU7mDngQHBbrqT_txWPF1G26yN7Z6bAiimSunpC2HQOgsPI1VAJ9X3sr1Qovt/exec";

let currentSession = null;
let adminLoggedIn = false;
let markerLoggedIn = false;
let adminTimer = null;
let markerTimer = null;

const ADMIN_TIMEOUT = 3 * 60 * 1000;
const MARKER_TIMEOUT = 3 * 60 * 1000;

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => goToPage(btn.dataset.page));
});

function goToPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  document.getElementById(page).classList.add("active-page");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add("active");
}

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
  });
  return await res.json();
}

function msg(id, text, type="") {
  const el = document.getElementById(id);
  el.className = "message " + type;
  el.innerHTML = text;
}

function toggleServantType() {
  document.getElementById("servantType").classList.toggle("hidden", document.getElementById("servant").value !== "Yes");
}

async function validateSession() {
  const code = document.getElementById("writerSessionCode").value.trim().toUpperCase();
  if (!code) return msg("sessionMessage", "Please enter session code.", "error");

  const res = await api("validateSession", { code });
  if (!res.ok) {
    currentSession = null;
    document.getElementById("writerForm").classList.add("hidden");
    return msg("sessionMessage", res.message, "error");
  }

  currentSession = res.session;
  document.getElementById("writerForm").classList.remove("hidden");
  msg("sessionMessage", `Valid session: ${res.session.session_day} | ${res.session.session_date} | ${res.session.session_time}`, "success");
}

async function submitWriter() {
  console.log("Submit clicked");

  const data = {
    session_code: getValue("writerSessionCode"),
    name: getValue("name"),
    surname: getValue("surname"),
    email: getValue("email"),
    cellphone_number: getValue("cellphone"),
    membership_number: getValue("membership"),
    state: getValue("state"),
    spiritual_centre: getValue("centre"),
    year_started_ekhayeni: getValue("yearStarted"),

    // your HTML uses inhlambulukoDate
    date_of_imhlabuluko: getValue("inhlambulukoDate"),

    servant: getValue("servant"),
    servant_type: getValue("servantType")
  };

  console.log("Writer data:", data);

  const required = [
    "session_code",
    "name",
    "surname",
    "email",
    "cellphone_number",
    "membership_number",
    "state",
    "spiritual_centre",
    "year_started_ekhayeni",
    "date_of_imhlabuluko",
    "servant"
  ];

  if (data.servant === "Yes") {
    required.push("servant_type");
  }

  const missing = required.filter(key => !data[key]);

  if (missing.length > 0) {
    alert("Please complete all mandatory fields. Missing: " + missing.join(", "));
    return;
  }

  const res = await api("registerWriter", data);
  console.log("Register response:", res);

  if (!res.ok) {
    alert(res.message);
    return;
  }

  alert("Thank you for the registration. Your details were captured successfully.");

  document.getElementById("writerForm").reset();
  document.getElementById("writerForm").classList.add("hidden");
  document.getElementById("writerSessionCode").value = "";
  msg("sessionMessage", "");
}

function getValue(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error("Missing element ID:", id);
    return "";
  }
  return String(el.value || "").trim();
}

function val(id) {
  return document.getElementById(id).value.trim();
}

async function loadStats() {
  let selectedDate = val("statsDate");

  if (!selectedDate) {
    selectedDate = new Date().toISOString().slice(0, 10);
  }

  const res = await api("getStats", { date: selectedDate });

  if (!res.ok) return alert(res.message);

  document.getElementById("statRegistered").innerText = res.stats.registered;
  document.getElementById("statMarked").innerText = res.stats.marked;
  document.getElementById("statPassed").innerText = res.stats.passed;
  document.getElementById("statFailed").innerText = res.stats.failed;
  document.getElementById("statUnsent").innerText = res.stats.unsent;
}

async function adminLogin() {
  const password = val("adminPassword");
  const res = await api("adminLogin", { password });
  if (!res.ok) return alert("Incorrect admin password.");

  adminLoggedIn = true;
  document.getElementById("adminLogin").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");
  resetAdminTimer();
  setSessionTimeOptions();
}

function adminLogout() {
  adminLoggedIn = false;
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("adminLogin").classList.remove("hidden");
}

function resetAdminTimer() {
  clearTimeout(adminTimer);
  adminTimer = setTimeout(() => {
    if (adminLoggedIn) {
      alert("Admin logged out after 3 minutes of inactivity.");
      adminLogout();
    }
  }, ADMIN_TIMEOUT);
}

function markerLogin() {
  api("markerLogin", { password: val("markerPassword") }).then(res => {
    if (!res.ok) return alert("Incorrect marker password.");
    markerLoggedIn = true;
    document.getElementById("markerLogin").classList.add("hidden");
    document.getElementById("markerPanel").classList.remove("hidden");
    resetMarkerTimer();
  });
}

function markerLogout() {
  markerLoggedIn = false;
  document.getElementById("markerPanel").classList.add("hidden");
  document.getElementById("markerLogin").classList.remove("hidden");
}

function resetMarkerTimer() {
  clearTimeout(markerTimer);
  markerTimer = setTimeout(() => {
    if (markerLoggedIn) {
      alert("Marker logged out after 3 minutes of inactivity.");
      markerLogout();
    }
  }, MARKER_TIMEOUT);
}

document.addEventListener("click", () => {
  if (adminLoggedIn) resetAdminTimer();
  if (markerLoggedIn) resetMarkerTimer();
});

function showAdminTool(tool) {
  document.querySelectorAll(".admin-tool").forEach(x => x.classList.add("hidden"));
  document.getElementById("admin" + capitalize(tool)).classList.remove("hidden");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function setSessionTimeOptions() {
  const d = document.getElementById("sessionDate").value;
  const select = document.getElementById("sessionTime");
  const day = d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }) : "";
  const sessions = {
    Tuesday: ["09:00 - 11:00", "15:00 - 17:00"],
    Wednesday: ["09:00 - 11:00", "15:00 - 17:00"],
    Thursday: ["07:00 - 11:00", "12:00 - 14:00", "15:00 - 17:00"],
    Friday: ["07:00 - 11:00", "12:00 - 14:00", "15:00 - 17:00"],
    Saturday: ["13:00 - 15:00"],
  };
  select.innerHTML = "";
  (sessions[day] || []).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

document.getElementById("sessionDate")?.addEventListener("change", setSessionTimeOptions);

async function generateSessionCode() {
  const res = await api("generateSessionCode", {
    date: val("sessionDate"),
    time: val("sessionTime")
  });
  if (!res.ok) return alert(res.message);
  document.getElementById("sessionCodeResult").innerText = res.code;
}

async function markerFindWriter() {
  const membership = val("markerSearch");

  const res = await api("findWriterForMarking", { membership_number: membership });
  const box = document.getElementById("markerWriterResult");

  if (!res.ok) {
    box.innerHTML = `<p class="error">${res.message}</p>`;
    return;
  }

  const w = res.writer;

  box.innerHTML = `
    <div class="soft-card">
      <h3>${w.name} ${w.surname}</h3>
      <p><b>Email:</b> ${w.email}</p>
      <p><b>Membership:</b> ${w.membership_number}</p>
      <p><b>Servant:</b> ${w.servant} ${w.servant_type || ""}</p>

      <input id="markInput" type="number" min="0" max="90" step="0.5" placeholder="Mark out of 90"/>

      <button onclick="saveMark('${w.membership_number}')">Save Mark</button>
    </div>
  `;
}

async function saveMark(membership) {
  const mark = document.getElementById("markInput").value;
  const res = await api("saveMark", { membership_number: membership, mark });
  if (!res.ok) return alert(res.message);
  alert(`Mark saved. Result: ${res.result}`);
  document.getElementById("markerWriterResult").innerHTML = "";
}

async function adminFindWriter() {
  const res = await api("findWriter", {
    membership_number: val("adminWriterSearch")
  });

  const box = document.getElementById("adminWriterResult");

  if (!res.ok) {
    box.innerHTML = `<p class="error">${res.message}</p>`;
    return;
  }

  const w = res.writer;

  box.innerHTML = `
    <div class="form-grid">

      <div class="field">
        <label>Name</label>
        <input id="editName" value="${w.name}">
      </div>

      <div class="field">
        <label>Surname</label>
        <input id="editSurname" value="${w.surname}">
      </div>

      <div class="field">
        <label>Email</label>
        <input id="editEmail" value="${w.email}">
      </div>

      <div class="field">
        <label>Cellphone</label>
        <input id="editPhone" value="${w.cellphone_number}">
      </div>

      <div class="field">
        <label>State</label>
        <input id="editState" value="${w.state}">
      </div>

      <div class="field">
        <label>Spiritual Centre</label>
        <input id="editCentre" value="${w.spiritual_centre}">
      </div>

    </div>

    <div style="margin-top:15px;">
      <button onclick="updateWriter('${w.membership_number}')">Update Writer</button>
      <button onclick="deleteWriter('${w.membership_number}')">Delete Writer</button>
    </div>
  `;
}

async function updateWriter(membership) {
  const res = await api("updateWriter", {
    membership_number: membership,
    name: val("editName"),
    surname: val("editSurname"),
    email: val("editEmail"),
    cellphone_number: val("editPhone"),
    state: val("editState"),
    spiritual_centre: val("editCentre"),
  });
  alert(res.message);
}

async function deleteWriter(membership) {
  if (!confirm("Delete this writer?")) return;
  const res = await api("deleteWriter", { membership_number: membership });
  alert(res.message);
  document.getElementById("adminWriterResult").innerHTML = "";
}

async function adminFindMark() {
  const res = await api("findMark", { membership_number: val("adminMarkSearch") });
  const box = document.getElementById("adminMarkResult");
  if (!res.ok) return box.innerHTML = `<p class="error">${res.message}</p>`;

  const m = res.mark;
  box.innerHTML = `
    <p><b>Current mark:</b> ${m.mark}/90</p>
    <p><b>Result:</b> ${m.result}</p>
    <p><b>Email sent:</b> ${m.email_sent}</p>
    <input id="remarkMark" type="number" min="0" max="90" step="0.5" placeholder"findWriter"="New mark"/>
    <button onclick="updateMark('${m.membership_number}')">Update Mark and Allow Email Resend</button>
    <button onclick="deleteMark('${m.membership_number}')">Delete Mark</button>
  `;
}

async function updateMark(membership) {
  const res = await api("updateMark", { membership_number: membership, mark: val("remarkMark") });
  alert(res.message);
}

async function deleteMark(membership) {
  if (!confirm("Delete this mark?")) return;
  const res = await api("deleteMark", { membership_number: membership });
  alert(res.message);
}

async function resendOneEmail() {
  const res = await api("resendEmail", { membership_number: val("resendMember") });
  document.getElementById("emailControlResult").innerText = res.message;
}

async function sendPendingBatch() {
  const res = await api("sendPendingBatch", {});
  document.getElementById("emailControlResult").innerText = res.message;
}

async function loadAuditLogs() {
  const res = await api("auditLogs", { search: val("auditSearch") });
  renderTable("auditTable", res.logs || []);
}

async function loadAuditLogsPublic() {
  const res = await api("auditLogs", { search: val("auditSearchPublic") });
  renderTable("auditTablePublic", res.logs || []);
}

function renderTable(id, rows) {
  if (!rows.length) {
    document.getElementById(id).innerHTML = "<p>No records found.</p>";
    return;
  }

  const keys = Object.keys(rows[0]);
  let html = "<table><thead><tr>" + keys.map(k => `<th>${k}</th>`).join("") + "</tr></thead><tbody>";
  html += rows.map(r => "<tr>" + keys.map(k => `<td>${r[k] || ""}</td>`).join("") + "</tr>").join("");
  html += "</tbody></table>";
  document.getElementById(id).innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  const writerForm = document.getElementById("writerForm");

  if (writerForm) {
    writerForm.addEventListener("submit", function(e) {
      e.preventDefault();
      submitWriter();
    });
  }
});