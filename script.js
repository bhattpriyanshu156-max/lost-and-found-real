// Front-end for Graphic Era Lost & Found. Talks to the Node/MySQL server through /api/*.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const { body, ...rest } = options;
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...rest,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function setMsg(text, isError) {
  const m = $("msg");
  if (!m) return;
  m.textContent = text;
  m.style.color = isError ? "#b3261e" : "";
}

// ---- who is logged in? (also fixes the navbar) ----
let currentStudent = null;
const ready = api("/api/me").then(d => { currentStudent = d.student; }).catch(() => {}).then(updateNav);

function updateNav() {
  if (!currentStudent) return;
  document.querySelectorAll('.nav-links a[href="login.html"], .nav-links a[href="registration.html"]')
    .forEach(a => a.remove());
  const nav = document.querySelector(".nav-links");
  if (!nav) return;
  const out = document.createElement("a");
  out.href = "#";
  out.textContent = "Logout (" + currentStudent.full_name.split(" ")[0] + ")";
  out.addEventListener("click", async (e) => {
    e.preventDefault();
    await api("/api/logout", { method: "POST" });
    location.href = "index.html";
  });
  nav.appendChild(out);
}

// ---- item cards ----
function itemCard(i, withActions) {
  let contact = "";
  if (i.reporter) {
    contact = "<small>Reported by " + esc(i.reporter) +
      (i.reporter_email ? " &middot; " + esc(i.reporter_email) : "") +
      (i.reporter_phone ? " &middot; " + esc(i.reporter_phone) : "") +
      (!i.reporter_email ? " (log in to see contact details)" : "") + "</small><br>";
  }
  let actions = "";
  if (withActions) {
    actions = '<div class="card-actions">' +
      (i.status === "open" ? '<button data-act="resolve" data-id="' + i.item_id + '">Mark as returned</button>' : "") +
      '<button class="danger" data-act="delete" data-id="' + i.item_id + '">Delete</button></div>';
  }
  const badge = withActions
    ? '<span class="badge ' + esc(i.type) + '">' + esc(i.type) + "</span>" +
      (i.status === "resolved" ? '<span class="badge done">returned</span>' : "")
    : "";
  return '<article class="item-card"><h3>' + esc(i.name) + "</h3>" + badge +
    "<p>" + esc(i.description) + "</p>" + contact +
    "<small>Location: " + esc(i.location) + " &middot; " + esc(i.item_date) + "</small>" + actions + "</article>";
}

// ---- lost / found pages ----
async function loadList(type, q) {
  const el = $("list");
  try {
    const { items } = await api("/api/items?type=" + type + (q ? "&q=" + encodeURIComponent(q) : ""));
    await ready;
    el.innerHTML = items.length
      ? items.map(i => itemCard(i, false)).join("")
      : '<p class="empty">No ' + type + ' items ' + (q ? "match your search" : "reported yet") + '. <a href="add_item.html">Report one</a>.</p>';
  } catch (e) {
    el.innerHTML = '<p class="empty">Could not load items: ' + esc(e.message) + "</p>";
  }
}

function initList(type) {
  loadList(type, "");
  let timer;
  $("search").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => loadList(type, e.target.value.trim()), 300);
  });
}

// ---- home page stats ----
async function loadStats() {
  try {
    const s = await api("/api/stats");
    $("stats").innerHTML =
      '<div><strong>' + s.students + '</strong><span>Students registered</span></div>' +
      '<div><strong>' + s.lost_open + '</strong><span>Items still lost</span></div>' +
      '<div><strong>' + s.found_open + '</strong><span>Items waiting to be claimed</span></div>' +
      '<div><strong>' + s.resolved + '</strong><span>Items returned</span></div>';
  } catch (e) { $("stats").remove(); }
}

// ---- profile page ----
async function initProfile() {
  await ready;
  const box = $("profileBox"), list = $("list");
  if (!currentStudent) {
    box.innerHTML = '<p>Please <a href="login.html">log in</a> to see your profile.</p>';
    return;
  }
  const s = currentStudent;
  box.innerHTML = "<p><strong>" + esc(s.full_name) + "</strong></p>" +
    "<p>Roll no: " + esc(s.roll_no) + "<br>Course: " + esc(s.course) + " (year " + esc(s.year_of_study) + ")<br>" +
    "Email: " + esc(s.email) + "<br>Phone: " + esc(s.phone) + "</p>";

  async function refresh() {
    const { items } = await api("/api/my-items");
    list.innerHTML = items.length
      ? items.map(i => itemCard(i, true)).join("")
      : '<p class="empty">Nothing reported yet. <a href="add_item.html">Add an item</a>.</p>';
  }
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    try {
      if (btn.dataset.act === "delete") {
        if (!confirm("Delete this report?")) return;
        await api("/api/items/" + btn.dataset.id, { method: "DELETE" });
      } else {
        await api("/api/items/" + btn.dataset.id + "/resolve", { method: "PATCH" });
      }
      refresh();
    } catch (err) { alert(err.message); }
  });
  refresh();
}

// ---- add item ----
const addForm = $("addItemForm");
if (addForm) {
  const dateInput = $("date");
  dateInput.max = new Date().toISOString().slice(0, 10);
  ready.then(() => { if (!currentStudent) $("loginNote").hidden = false; });
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(addForm));
    try {
      await api("/api/items", { method: "POST", body: f });
      setMsg("Item saved. View it under " + (f.type === "lost" ? "Lost Items" : "Found Items") + ".");
      addForm.reset();
    } catch (err) { setMsg(err.message, true); }
  });
}

// ---- login ----
const loginForm = $("loginForm");
if (loginForm) loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/login", { method: "POST", body: { email: loginForm.email.value, password: loginForm.password.value } });
    location.href = "profile.html";
  } catch (err) { setMsg(err.message, true); }
});

// ---- registration ----
const regForm = $("regForm");
if (regForm) regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (regForm.password.value !== regForm.confirm.value) { setMsg("Passwords do not match.", true); return; }
  const f = Object.fromEntries(new FormData(regForm));
  delete f.confirm;
  try {
    await api("/api/register", { method: "POST", body: f });
    setMsg("Registered! Redirecting to login...");
    setTimeout(() => { location.href = "login.html"; }, 1200);
  } catch (err) { setMsg(err.message, true); }
});
