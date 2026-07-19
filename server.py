#!/usr/bin/env python3
import cgi
import hashlib
import hmac
import json
import os
import secrets
import shutil
import sqlite3
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "pulse3d.sqlite3"
UPLOAD_DIR = ROOT / "uploads"
SESSION_COOKIE = "pulse3d_session"
VISITOR_COOKIE = "pulse3d_visitor"
ADMIN_EMAIL = os.environ.get("PULSE3D_ADMIN_EMAIL", "admin@pulse3d.local")
ADMIN_PASSWORD = os.environ.get("PULSE3D_ADMIN_PASSWORD", "ChangeMe123!")
SESSIONS = {}


def db():
  connection = sqlite3.connect(DB_PATH)
  connection.row_factory = sqlite3.Row
  return connection


def hash_password(password, salt=None):
  salt = salt or secrets.token_hex(16)
  digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
  return f"{salt}${digest.hex()}"


def verify_password(password, stored):
  salt, _expected = stored.split("$", 1)
  return hmac.compare_digest(hash_password(password, salt), stored)


def init_db():
  UPLOAD_DIR.mkdir(exist_ok=True)
  with db() as connection:
    connection.executescript(
      """
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('public', 'admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        file_name TEXT NOT NULL,
        stored_file TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(uploaded_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(design_id) REFERENCES designs(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        count INTEGER NOT NULL DEFAULT 0
      );
      """
    )
    connection.execute("INSERT OR IGNORE INTO visits (id, count) VALUES (1, 0)")
    existing_admin = connection.execute(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    ).fetchone()
    if not existing_admin:
      connection.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
        (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD)),
      )


def row_to_design(row):
  return {
    "id": row["id"],
    "name": row["name"],
    "price": row["price"],
    "fileName": row["file_name"],
    "createdAt": row["created_at"],
  }


def clean_file_name(name):
  safe = "".join(character for character in name if character.isalnum() or character in "._- ")
  return safe.strip().replace(" ", "-") or "design.stl"


class PulseHandler(SimpleHTTPRequestHandler):
  def translate_path(self, path):
    parsed = urlparse(path)
    clean_path = parsed.path.lstrip("/") or "index.html"
    return str(ROOT / clean_path)

  def end_headers(self):
    self.send_header("X-Content-Type-Options", "nosniff")
    super().end_headers()

  def do_GET(self):
    route = urlparse(self.path).path
    if route == "/api/me":
      return self.get_me()
    if route == "/api/designs":
      return self.get_designs()
    if route == "/api/visits":
      return self.get_visits()
    return super().do_GET()

  def do_POST(self):
    route = urlparse(self.path).path
    if route == "/api/register":
      return self.register()
    if route == "/api/login":
      return self.login()
    if route == "/api/logout":
      return self.logout()
    if route == "/api/designs":
      return self.create_design()
    if route == "/api/purchases":
      return self.create_purchase()
    self.send_error(HTTPStatus.NOT_FOUND)

  def json_response(self, payload, status=HTTPStatus.OK, extra_headers=None):
    body = json.dumps(payload).encode()
    self.send_response(status)
    self.send_header("Content-Type", "application/json")
    self.send_header("Content-Length", str(len(body)))
    if extra_headers:
      for key, value in extra_headers.items():
        self.send_header(key, value)
    self.end_headers()
    self.wfile.write(body)

  def read_json(self):
    length = int(self.headers.get("Content-Length", "0"))
    if length == 0:
      return {}
    return json.loads(self.rfile.read(length).decode())

  def session_user(self):
    cookie = SimpleCookie(self.headers.get("Cookie"))
    token = cookie.get(SESSION_COOKIE)
    if not token or token.value not in SESSIONS:
      return None
    user_id = SESSIONS[token.value]
    with db() as connection:
      return connection.execute(
        "SELECT id, email, role FROM users WHERE id = ?", (user_id,)
      ).fetchone()

  def require_user(self, role=None):
    user = self.session_user()
    if not user:
      self.json_response({"error": "Login required."}, HTTPStatus.UNAUTHORIZED)
      return None
    if role and user["role"] != role:
      self.json_response({"error": "Admin access required."}, HTTPStatus.FORBIDDEN)
      return None
    return user

  def get_me(self):
    user = self.session_user()
    if not user:
      return self.json_response({"authenticated": False})
    return self.json_response(
      {"authenticated": True, "email": user["email"], "role": user["role"]}
    )

  def register(self):
    data = self.read_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if "@" not in email or len(password) < 8:
      return self.json_response(
        {"error": "Use an email and a password of at least 8 characters."},
        HTTPStatus.BAD_REQUEST,
      )
    try:
      with db() as connection:
        cursor = connection.execute(
          "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'public')",
          (email, hash_password(password)),
        )
    except sqlite3.IntegrityError:
      return self.json_response({"error": "That email is already registered."}, HTTPStatus.CONFLICT)

    token = secrets.token_urlsafe(32)
    SESSIONS[token] = cursor.lastrowid
    headers = {"Set-Cookie": f"{SESSION_COOKIE}={token}; HttpOnly; Path=/; SameSite=Lax"}
    return self.json_response(
      {"email": email, "role": "public"},
      HTTPStatus.CREATED,
      extra_headers=headers,
    )

  def login(self):
    data = self.read_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role")
    with db() as connection:
      user = connection.execute(
        "SELECT id, email, password_hash, role FROM users WHERE email = ?", (email,)
      ).fetchone()
    if not user or not verify_password(password, user["password_hash"]):
      return self.json_response({"error": "Incorrect email or password."}, HTTPStatus.UNAUTHORIZED)
    if role and user["role"] != role:
      return self.json_response({"error": "This account does not have that role."}, HTTPStatus.FORBIDDEN)

    token = secrets.token_urlsafe(32)
    SESSIONS[token] = user["id"]
    headers = {"Set-Cookie": f"{SESSION_COOKIE}={token}; HttpOnly; Path=/; SameSite=Lax"}
    return self.json_response(
      {"email": user["email"], "role": user["role"]},
      extra_headers=headers,
    )

  def logout(self):
    cookie = SimpleCookie(self.headers.get("Cookie"))
    token = cookie.get(SESSION_COOKIE)
    if token:
      SESSIONS.pop(token.value, None)
    return self.json_response(
      {"ok": True},
      extra_headers={"Set-Cookie": f"{SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax"},
    )

  def get_designs(self):
    with db() as connection:
      rows = connection.execute(
        "SELECT id, name, price, file_name, created_at FROM designs ORDER BY created_at DESC"
      ).fetchall()
    return self.json_response({"designs": [row_to_design(row) for row in rows]})

  def create_design(self):
    user = self.require_user("admin")
    if not user:
      return

    form = cgi.FieldStorage(
      fp=self.rfile,
      headers=self.headers,
      environ={
        "REQUEST_METHOD": "POST",
        "CONTENT_TYPE": self.headers.get("Content-Type"),
        "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
      },
    )
    name = form.getfirst("name", "").strip()
    price = form.getfirst("price", "").strip()
    file_item = form["file"] if "file" in form else None
    if not name or not price or file_item is None or not file_item.filename:
      return self.json_response({"error": "Name, price, and STL file are required."}, HTTPStatus.BAD_REQUEST)
    if not file_item.filename.lower().endswith(".stl"):
      return self.json_response({"error": "Only STL files are allowed."}, HTTPStatus.BAD_REQUEST)

    try:
      numeric_price = float(price)
    except ValueError:
      return self.json_response({"error": "Price must be a number."}, HTTPStatus.BAD_REQUEST)

    original_name = clean_file_name(file_item.filename)
    stored_name = f"{secrets.token_hex(12)}-{original_name}"
    with (UPLOAD_DIR / stored_name).open("wb") as destination:
      shutil.copyfileobj(file_item.file, destination)

    with db() as connection:
      cursor = connection.execute(
        """
        INSERT INTO designs (name, price, file_name, stored_file, uploaded_by)
        VALUES (?, ?, ?, ?, ?)
        """,
        (name, numeric_price, original_name, stored_name, user["id"]),
      )
      row = connection.execute(
        "SELECT id, name, price, file_name, created_at FROM designs WHERE id = ?",
        (cursor.lastrowid,),
      ).fetchone()
    return self.json_response({"design": row_to_design(row)}, HTTPStatus.CREATED)

  def create_purchase(self):
    user = self.require_user()
    if not user:
      return
    data = self.read_json()
    design_id = data.get("designId")
    with db() as connection:
      design = connection.execute("SELECT id, name FROM designs WHERE id = ?", (design_id,)).fetchone()
      if not design:
        return self.json_response({"error": "Design not found."}, HTTPStatus.NOT_FOUND)
      connection.execute(
        "INSERT INTO purchases (design_id, user_id) VALUES (?, ?)",
        (design["id"], user["id"]),
      )
    return self.json_response({"message": f"Purchase request saved for {design['name']}."})

  def get_visits(self):
    cookie = SimpleCookie(self.headers.get("Cookie"))
    visitor = cookie.get(VISITOR_COOKIE)
    headers = {}
    with db() as connection:
      if not visitor:
        connection.execute("UPDATE visits SET count = count + 1 WHERE id = 1")
        headers["Set-Cookie"] = f"{VISITOR_COOKIE}={secrets.token_urlsafe(24)}; Path=/; SameSite=Lax"
      count = connection.execute("SELECT count FROM visits WHERE id = 1").fetchone()["count"]
    return self.json_response({"count": count}, extra_headers=headers)


if __name__ == "__main__":
  init_db()
  port = int(os.environ.get("PORT", "8000"))
  server = ThreadingHTTPServer(("127.0.0.1", port), PulseHandler)
  print(f"Pulse 3D running at http://127.0.0.1:{port}")
  print(f"Default admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
  server.serve_forever()
