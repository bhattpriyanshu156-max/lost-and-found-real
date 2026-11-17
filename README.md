# Graphic Era – Campus Lost & Found

A web portal for Graphic Era students to report lost items and find items that others have found.
Student records and item reports are stored in a **MySQL** database.

**Stack:** HTML, CSS, JavaScript (front-end) · Node.js + Express (server) · MySQL (database)

## Folder structure

```
campus_lost_and_found/
├── server.js             Express server + all API routes
├── package.json          Node dependencies
├── .env.example          Copy to .env and add your MySQL password
├── database/
│   ├── schema.sql        Creates the database, tables and a view
│   └── sample_queries.sql  Useful SQL for your viva / demo
└── public/               The website (your original pages)
    ├── index.html  login.html  registration.html  profile.html
    ├── add_item.html  lost_item.html  found_item.html
    ├── 1.css
    └── script.js
```

## How to run

1. Install **Node.js** (LTS) and **MySQL Server** (or XAMPP and start MySQL).
2. Create the database. In a terminal inside this folder:
   ```
   mysql -u root -p < database/schema.sql
   ```
   (Or open `database/schema.sql` in MySQL Workbench and run it.)
3. Copy `.env.example` to `.env` and put your MySQL password in it.
4. Install and start:
   ```
   npm install
   npm start
   ```
5. Open **http://localhost:3000** in your browser.

Do not open the HTML files directly by double-clicking. They need the server running.

## Database design

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `students` | Student records | `student_id` (PK), `roll_no` (unique), `email` (unique), `course`, `year_of_study`, `password_hash` |
| `items` | Lost / found reports | `item_id` (PK), `student_id` (FK → students), `type` (lost/found), `status` (open/resolved) |
| `v_open_items` (view) | Open items joined with reporter details | |

One student can report many items (one-to-many). Deleting a student deletes their reports (`ON DELETE CASCADE`).
Passwords are stored as bcrypt hashes, and all queries use prepared statements.

## Features

- Student registration (name, roll no, email, phone, course, year) and login
- Report a lost or found item (login required)
- Browse and search lost items and found items
- Contact details of the reporter are visible only to logged-in students
- Profile page with your details, plus "Mark as returned" and "Delete" for your own reports
- Live counters on the home page
