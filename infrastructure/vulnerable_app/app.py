"""
Intentionally vulnerable Flask application for Module 7 SAST exercises.
DO NOT deploy this in production. Every vulnerability here is deliberate.

Vulnerabilities present:
1. SQL Injection (line ~40)    -- CWE-89
2. Hardcoded API key (line ~15) -- CWE-798
3. eval() with user input (line ~55) -- CWE-95
4. Insecure deserialization with pickle (line ~65) -- CWE-502
"""

import sqlite3
import pickle
import base64
from flask import Flask, request, jsonify

app = Flask(__name__)

# VULNERABILITY 1: Hardcoded secret / API key
# This should be loaded from environment variables, never hardcoded.
API_SECRET_KEY = "sk-live-abc123supersecretkey99999"
DATABASE_ADMIN_PASSWORD = "admin:hunter2"


def get_db():
    conn = sqlite3.connect(":memory:")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)"
    )
    conn.execute("INSERT INTO users VALUES (1, 'alice', 'password123')")
    conn.execute("INSERT INTO users VALUES (2, 'bob', 'letmein')")
    conn.commit()
    return conn


@app.route("/user")
def get_user():
    user_id = request.args.get("id", "")
    conn = get_db()

    # VULNERABILITY 2: SQL Injection
    # User input is concatenated directly into the SQL query.
    # Fix: use parameterised queries → cursor.execute("SELECT * FROM users WHERE id=?", (user_id,))
    query = "SELECT * FROM users WHERE id=" + user_id
    cursor = conn.execute(query)
    row = cursor.fetchone()

    if row:
        return jsonify({"id": row[0], "username": row[1]})
    return jsonify({"error": "not found"}), 404


@app.route("/calculate")
def calculate():
    expression = request.args.get("expr", "")

    # VULNERABILITY 3: eval() with user-controlled input
    # An attacker can pass arbitrary Python code as the expression.
    # Fix: use ast.literal_eval() or a safe math parser.
    result = eval(expression)  # noqa: S307
    return jsonify({"result": result})


@app.route("/restore", methods=["POST"])
def restore_session():
    data = request.get_data()

    # VULNERABILITY 4: Insecure deserialization
    # pickle.loads() on untrusted input allows arbitrary code execution.
    # Fix: use JSON or a safe serialisation format; never pickle untrusted data.
    session_data = pickle.loads(base64.b64decode(data))  # noqa: S301
    return jsonify({"session": str(session_data)})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
