require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'geu_lost_found',
  waitForConnections: true,
  connectionLimit: 10
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  });

const requireLogin = (req, res, next) =>
  req.session.studentId ? next() : res.status(401).json({ error: 'Please log in first.' });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------- auth ----------
app.post('/api/register', wrap(async (req, res) => {
  const fullName = clean(req.body.fullname, 100);
  const rollNo = clean(req.body.rollno, 30).toUpperCase();
  const email = clean(req.body.email, 120).toLowerCase();
  const phone = clean(req.body.phone, 15);
  const course = clean(req.body.course, 60);
  const year = parseInt(req.body.year, 10);
  const password = String(req.body.password || '');

  if (!fullName || !rollNo || !course || !phone) return res.status(400).json({ error: 'Please fill in all fields.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!/^[0-9+\- ]{10,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (!(year >= 1 && year <= 5)) return res.status(400).json({ error: 'Year must be between 1 and 5.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.execute(
      `INSERT INTO students (full_name, roll_no, email, phone, course, year_of_study, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fullName, rollNo, email, phone, course, year, hash]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email or roll number is already registered.' });
    throw err;
  }
  res.status(201).json({ ok: true });
}));

app.post('/api/login', wrap(async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const [rows] = await pool.execute('SELECT student_id, full_name, password_hash FROM students WHERE email = ?', [email]);
  const ok = rows.length && await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Server error.' });
    req.session.studentId = rows[0].student_id;
    res.json({ ok: true, name: rows[0].full_name });
  });
}));

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', wrap(async (req, res) => {
  if (!req.session.studentId) return res.json({ student: null });
  const [rows] = await pool.execute(
    `SELECT student_id, full_name, roll_no, email, phone, course, year_of_study
     FROM students WHERE student_id = ?`, [req.session.studentId]);
  res.json({ student: rows[0] || null });
}));

// ---------- stats (home page) ----------
app.get('/api/stats', wrap(async (req, res) => {
  const [[row]] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM students) AS students,
       (SELECT COUNT(*) FROM items WHERE type = 'lost'  AND status = 'open') AS lost_open,
       (SELECT COUNT(*) FROM items WHERE type = 'found' AND status = 'open') AS found_open,
       (SELECT COUNT(*) FROM items WHERE status = 'resolved') AS resolved`);
  res.json(row);
}));

// ---------- items ----------
app.get('/api/items', wrap(async (req, res) => {
  const type = req.query.type;
  const q = clean(req.query.q, 60);
  const where = ["i.status = 'open'"];
  const params = [];
  if (type === 'lost' || type === 'found') { where.push('i.type = ?'); params.push(type); }
  if (q) {
    where.push('(i.name LIKE ? OR i.description LIKE ? OR i.location LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await pool.execute(
    `SELECT i.item_id, i.type, i.name, i.description, i.location,
            DATE_FORMAT(i.item_date, '%Y-%m-%d') AS item_date,
            s.full_name AS reporter, s.email AS reporter_email, s.phone AS reporter_phone
     FROM items i JOIN students s ON s.student_id = i.student_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.created_at DESC`, params);
  // contact details are only shown to logged-in students
  if (!req.session.studentId) rows.forEach((r) => { delete r.reporter_email; delete r.reporter_phone; });
  res.json({ items: rows });
}));

app.get('/api/my-items', requireLogin, wrap(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT item_id, type, name, description, location,
            DATE_FORMAT(item_date, '%Y-%m-%d') AS item_date, status
     FROM items WHERE student_id = ? ORDER BY created_at DESC`, [req.session.studentId]);
  res.json({ items: rows });
}));

app.post('/api/items', requireLogin, wrap(async (req, res) => {
  const type = req.body.type;
  const name = clean(req.body.name, 100);
  const description = clean(req.body.description, 1000);
  const location = clean(req.body.location, 150);
  const date = clean(req.body.date, 10);

  if (type !== 'lost' && type !== 'found') return res.status(400).json({ error: 'Choose lost or found.' });
  if (!name || !description || !location) return res.status(400).json({ error: 'Please fill in all fields.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return res.status(400).json({ error: 'Enter a valid date.' });
  if (new Date(date) > new Date()) return res.status(400).json({ error: 'Date cannot be in the future.' });

  const [result] = await pool.execute(
    `INSERT INTO items (student_id, type, name, description, location, item_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.session.studentId, type, name, description, location, date]);
  res.status(201).json({ ok: true, item_id: result.insertId });
}));

app.patch('/api/items/:id/resolve', requireLogin, wrap(async (req, res) => {
  const [r] = await pool.execute(
    "UPDATE items SET status = 'resolved' WHERE item_id = ? AND student_id = ?",
    [req.params.id, req.session.studentId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
}));

app.delete('/api/items/:id', requireLogin, wrap(async (req, res) => {
  const [r] = await pool.execute(
    'DELETE FROM items WHERE item_id = ? AND student_id = ?',
    [req.params.id, req.session.studentId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
}));

app.listen(PORT, () => console.log(`GEU Lost & Found running at http://localhost:${PORT}`));
