import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// open the database file
const db = await open({
  filename: "chat.db",
  driver: sqlite3.Database,
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});
let roomIdGlobal ="room1";

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});
app.get("/chat", (req, res) => {
  res.sendFile(join(__dirname, "chat.html"));
});

io.on("connection", async (socket) => {
  //TODO: ソケットの人数をカウントする, sqlでデータを取得して表示する
  socket.on("chat message", async (msg, roomId) => {
    socket.join(roomId);
    roomId = roomId;
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${socket.handshake.auth.roomId} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_offset TEXT UNIQUE,
          content TEXT
      );
    `);

    console.log("roomId", roomId);
    let result;
    try {
      result = await db.run(`INSERT INTO ${roomId} (content) VALUES (?)`, msg);
    } catch (e) {
      console.log(e);
      return;
    }
    io.to(roomId).emit("chat message", msg, result.lastID);
  });

  //NOTE: サーバーに不足しているメッセージを取得する
  //TODO: userを指定して取得する
  if (!socket.recovered) {
    socket.join(socket.handshake.auth.roomId);

    try {
      await db.each(
        `SELECT id, content FROM ${socket.handshake.auth.roomId} WHERE id > ?`,
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {

          io.to(socket.handshake.auth.roomId).emit("chat message", row.content, row.id);
        }
      );
    } catch (e) {
      console.log(e);
    }
  }
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
