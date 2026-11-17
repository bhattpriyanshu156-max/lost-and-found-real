USE geu_lost_found;

-- All student records
SELECT student_id, full_name, roll_no, course, year_of_study FROM students;

-- Open lost items, newest first
SELECT * FROM v_open_items WHERE type = 'lost' ORDER BY item_date DESC;

-- Number of reports per student
SELECT s.full_name, s.roll_no, COUNT(i.item_id) AS total_reports
FROM students s LEFT JOIN items i ON i.student_id = s.student_id
GROUP BY s.student_id ORDER BY total_reports DESC;

-- Lost vs found, open vs resolved summary
SELECT type, status, COUNT(*) AS total FROM items GROUP BY type, status;

-- Search items by keyword
SELECT * FROM v_open_items
WHERE name LIKE '%wallet%' OR description LIKE '%wallet%' OR location LIKE '%wallet%';

-- Possible matches: a lost and a found item with the same name
SELECT l.name, l.item_id AS lost_id, f.item_id AS found_id, f.location AS found_at
FROM items l JOIN items f ON LOWER(l.name) = LOWER(f.name)
WHERE l.type = 'lost' AND f.type = 'found' AND l.status = 'open' AND f.status = 'open';

-- Mark an item as returned
-- UPDATE items SET status = 'resolved' WHERE item_id = 1;
