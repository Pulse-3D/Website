PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('public', 'admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
INSERT INTO users VALUES(1,'admin@pulse3d.local','83cc964d13e6a37645434bfe4d59efd8$2d552de50d46252e612c626ba7f84e683ba46fa94b3d4419874d30aaeaf61963','admin','2026-07-19 14:29:42');
INSERT INTO users VALUES(3,'newuser@example.com','68c25c8893a3e9802f6d0e251f46740a$94892c8f27811ca741447f549be7b7528bd7528c347a6cf13e361c226add9efe','public','2026-07-19 15:06:02');
INSERT INTO users VALUES(4,'kumaraarush022@gmail.com','bbda4944971b4569a9fca1060edd14aa$b4045a4a9326f5b5ed242b17d575747ec8c99c6e5e080b4e2fd385cef37268ba','public','2026-07-19 15:52:44');
CREATE TABLE designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        file_name TEXT NOT NULL,
        stored_file TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(uploaded_by) REFERENCES users(id)
      );
CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(design_id) REFERENCES designs(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
CREATE TABLE visits (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        count INTEGER NOT NULL DEFAULT 0
      );
INSERT INTO visits VALUES(1,2);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('users',4);
INSERT INTO sqlite_sequence VALUES('designs',1);
COMMIT;
