import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export const dataDir = path.join(process.cwd(), "data");
export const videoDir = path.join(dataDir, "videos");

export type User = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
};

export type Video = {
  id: string;
  owner_id: string;
  title: string;
  fencer_name: string;
  fencer_side: "left" | "right";
  filename: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
};

export type Exchange = {
  id: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  action: string;
  result: "success" | "failed" | "neither";
  remark: string | null;
  sort_index: number;
};

export type Playlist = {
  id: string;
  owner_id: string;
  competition_name: string;
  fencer_name: string;
  created_at: string;
};

function openDatabase() {
  fs.mkdirSync(videoDir, { recursive: true });
  const database = new Database(path.join(dataDir, "app.db"));
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      fencer_name TEXT NOT NULL,
      fencer_side TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      remark TEXT,
      sort_index INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      competition_name TEXT NOT NULL,
      fencer_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playlist_videos (
      playlist_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      PRIMARY KEY (playlist_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      video_id TEXT,
      playlist_id TEXT,
      invitee_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return database;
}

const globalForDb = globalThis as unknown as { sabreDb?: Database.Database };
export const db = globalForDb.sabreDb ?? openDatabase();
globalForDb.sabreDb = db;

export function videoPath(video: Video) {
  return path.join(videoDir, video.filename);
}

export function findUserByEmail(email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as User | undefined;
}

export function findUserById(id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function insertUser(user: User) {
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(user.id, user.email, user.name, user.password_hash, user.password_salt, user.created_at);
}

export function insertSession(token: string, userId: string) {
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    new Date().toISOString(),
  );
}

export function userForSession(token: string) {
  return db
    .prepare(
      `SELECT users.* FROM users
       JOIN sessions ON sessions.user_id = users.id
       WHERE sessions.token = ?`,
    )
    .get(token) as User | undefined;
}

export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function insertVideo(video: Video) {
  db.prepare(
    `INSERT INTO videos
      (id, owner_id, title, fencer_name, fencer_side, filename, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    video.id,
    video.owner_id,
    video.title,
    video.fencer_name,
    video.fencer_side,
    video.filename,
    video.status,
    video.error,
    video.created_at,
  );
}

export function getVideo(id: string) {
  return db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as Video | undefined;
}

export function listOwnedVideos(userId: string) {
  return db
    .prepare("SELECT * FROM videos WHERE owner_id = ? ORDER BY created_at DESC")
    .all(userId) as Video[];
}

export function listSharedVideos(email: string) {
  return db
    .prepare(
      `SELECT videos.* FROM videos
       JOIN invites ON invites.video_id = videos.id
       WHERE invites.invitee_email = ? AND videos.owner_id != (
         SELECT id FROM users WHERE email = ? LIMIT 1
       )
       ORDER BY videos.created_at DESC`,
    )
    .all(email.toLowerCase(), email.toLowerCase()) as Video[];
}

export function setVideoStatus(id: string, status: Video["status"], error: string | null = null) {
  db.prepare("UPDATE videos SET status = ?, error = ? WHERE id = ?").run(status, error, id);
}

export function replaceExchanges(
  videoId: string,
  rows: Array<Omit<Exchange, "id" | "video_id" | "sort_index"> & { id: string }>,
) {
  const insert = db.prepare(
    `INSERT INTO exchanges
      (id, video_id, start_sec, end_sec, action, result, remark, sort_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const write = db.transaction(() => {
    db.prepare("DELETE FROM exchanges WHERE video_id = ?").run(videoId);
    rows.forEach((row, index) => {
      insert.run(row.id, videoId, row.start_sec, row.end_sec, row.action, row.result, row.remark, index);
    });
  });
  write();
}

export function listExchanges(videoId: string) {
  return db
    .prepare("SELECT * FROM exchanges WHERE video_id = ? ORDER BY sort_index ASC")
    .all(videoId) as Exchange[];
}

export function insertPlaylist(playlist: Playlist) {
  db.prepare(
    `INSERT INTO playlists (id, owner_id, competition_name, fencer_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(playlist.id, playlist.owner_id, playlist.competition_name, playlist.fencer_name, playlist.created_at);
}

export function getPlaylist(id: string) {
  return db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as Playlist | undefined;
}

export function listOwnedPlaylists(userId: string) {
  return db
    .prepare("SELECT * FROM playlists WHERE owner_id = ? ORDER BY created_at DESC")
    .all(userId) as Playlist[];
}

export function listSharedPlaylists(email: string) {
  return db
    .prepare(
      `SELECT playlists.* FROM playlists
       JOIN invites ON invites.playlist_id = playlists.id
       WHERE invites.invitee_email = ?
       ORDER BY playlists.created_at DESC`,
    )
    .all(email.toLowerCase()) as Playlist[];
}

export function findPlaylist(ownerId: string, fencerName: string, competitionName: string) {
  return db
    .prepare(
      `SELECT * FROM playlists
       WHERE owner_id = ? AND fencer_name = ? AND competition_name = ?`,
    )
    .get(ownerId, fencerName, competitionName) as Playlist | undefined;
}

export function addVideoToPlaylist(playlistId: string, videoId: string) {
  db.prepare("INSERT OR IGNORE INTO playlist_videos (playlist_id, video_id) VALUES (?, ?)").run(
    playlistId,
    videoId,
  );
}

export function listPlaylistVideos(playlistId: string) {
  return db
    .prepare(
      `SELECT videos.* FROM videos
       JOIN playlist_videos ON playlist_videos.video_id = videos.id
       WHERE playlist_videos.playlist_id = ?
       ORDER BY videos.created_at ASC`,
    )
    .all(playlistId) as Video[];
}

export function insertInvite(invite: {
  id: string;
  owner_id: string;
  video_id: string | null;
  playlist_id: string | null;
  invitee_email: string;
}) {
  db.prepare(
    `INSERT INTO invites (id, owner_id, video_id, playlist_id, invitee_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    invite.id,
    invite.owner_id,
    invite.video_id,
    invite.playlist_id,
    invite.invitee_email,
    new Date().toISOString(),
  );
}

export function listVideoInvites(videoId: string) {
  return db.prepare("SELECT invitee_email FROM invites WHERE video_id = ? ORDER BY created_at").all(videoId) as Array<{
    invitee_email: string;
  }>;
}

export function listPlaylistInvites(playlistId: string) {
  return db
    .prepare("SELECT invitee_email FROM invites WHERE playlist_id = ? ORDER BY created_at")
    .all(playlistId) as Array<{ invitee_email: string }>;
}

export function canAccessVideo(user: User, video: Video) {
  if (video.owner_id === user.id) return true;
  const invite = db
    .prepare("SELECT id FROM invites WHERE video_id = ? AND invitee_email = ?")
    .get(video.id, user.email);
  return Boolean(invite);
}

export function canAccessPlaylist(user: User, playlist: Playlist) {
  if (playlist.owner_id === user.id) return true;
  const invite = db
    .prepare("SELECT id FROM invites WHERE playlist_id = ? AND invitee_email = ?")
    .get(playlist.id, user.email);
  return Boolean(invite);
}
