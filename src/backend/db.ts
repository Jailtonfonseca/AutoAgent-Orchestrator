import Database from 'better-sqlite3';

export const db = new Database('history.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    task TEXT,
    model TEXT,
    language TEXT,
    ts INTEGER
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    kind TEXT,
    payload TEXT,
    ts INTEGER,
    FOREIGN KEY(task_id) REFERENCES tasks(id)
  );
`);

export function saveTask(id: string, task: string, model: string, language: string) {
  const stmt = db.prepare('INSERT INTO tasks (id, task, model, language, ts) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, task, model, language, Date.now());
}

export function saveMessage(taskId: string, kind: string, payload: any, ts: number) {
  const stmt = db.prepare('INSERT INTO messages (task_id, kind, payload, ts) VALUES (?, ?, ?, ?)');
  stmt.run(taskId, kind, JSON.stringify(payload), ts);
}

export function getTasks() {
  const stmt = db.prepare('SELECT * FROM tasks ORDER BY ts DESC');
  return stmt.all();
}

export function getMessages(taskId: string) {
  const stmt = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY ts ASC');
  return stmt.all().map((row: any) => ({
    ...row,
    payload: JSON.parse(row.payload)
  }));
}
