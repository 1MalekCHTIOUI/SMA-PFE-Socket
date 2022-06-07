const express = require("express");
const http = require("http");
const PORT = process.env.PORT || 8900;
const app = express();
const cors = require("cors");
const { v4 } = require("uuid");
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.use(cors());

let users = [];
const addUser = (userId, socketId, user) => {
  let test = true;
  users.map((user) => {
    if (user === userId) {
      return false;
    }
  });
  if (test) {
    !users.some((user) => user.userId === userId) &&
      users.push({ userId, socketId, user });
  }
};
const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};
const removeUser2 = (userId) => {
  users = users.filter((user) => user.userId !== userId);
};
const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

const ROOM_ID = v4();

const userss = {};

const socketToRoom = {};

io.on("connection", (socket) => {
  console.log("CONNECTED");
  socket.on("addUser", ({ userId, user }) => {
    addUser(userId, socket.id, user);
    io.emit("getUsers", users);
  });

  socket.on(
    "sendMessage",
    ({ senderId, receiverId, text, attachement, currentChat }) => {
      const user = getUser(receiverId);
      io.to(user?.socketId).emit("getMessage", {
        senderId,
        text,
        attachement,
        currentChat,
      });
    },
  );
  socket.on("newPost", ({ senderId, content }) => {
    // const user = getUser(receiverId)
    io.emit("newPost", {
      senderId,
      content,
    });
  });
  socket.on("newLike", ({ receiverId, content, postId }) => {
    const user = getUser(receiverId);
    io.to(user?.socketId).emit("newLike", {
      content,
      postId,
    });
  });

  socket.on("sendNotification", ({ senderId, receiverId, content }) => {
    const user = getUser(receiverId);
    io.to(user?.socketId).emit("getNotification", {
      senderId,
      content,
    });
  });

  socket.on("removeFromGroup", ({ currentChat, removedUser }) => {
    const user = getUser(removedUser);
    io.to(user?.socketId).emit("removedFromGroup", {
      currentChat: currentChat,
      removedUser,
    });
  });

  socket.on("addToGroup", ({ currentChat, addedUser }) => {
    const user = getUser(addedUser);
    io.to(user?.socketId).emit("addedToGroup", {
      currentChat: currentChat,
      addedUser,
    });
  });

  socket.on("createGroup", (data) => {
    if (data.members.length > 0) {
      data.members.map((m) => {
        const user = getUser(m);
        io.to(user?.socketId).emit("groupCreated", data);
      });
    }
  });
  socket.on("removeGroup", (data) => {
    if (data.members.length > 0) {
      data.members.map((m) => {
        const user = getUser(m);
        io.to(user?.socketId).emit("groupRemoved", data);
      });
    }
  });

  socket.on("callNotif", ({ caller, id, room }) => {
    const user = getUser(id);
    try {
      io.to(user?.socketId).emit("notif", {
        msg: `${caller.fullName} is calling you!`,
        caller: caller.fullName,
      });
      io.to(user?.socketId).emit("getCallerID", caller.id);
      io.to(user?.socketId).emit("getRoomID", room);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("declineCall", ({ callerId, declinerName }) => {
    const user = getUser(callerId);
    try {
      io.to(user?.socketId).emit("callDeclined", {
        msg: `${declinerName} declined your call!`,
      });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("acceptCall", ({ callerId, acceptName }) => {
    const user = getUser(callerId);
    try {
      io.to(user?.socketId).emit("callAccepted", {
        acceptName: acceptName,
        status: true,
      });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", () => {
    const roomID = socketToRoom[socket.id];
    let room = userss[roomID];
    removeUser(socket.id);
    io.emit("getUsers", users);

    if (room) {
      room = room.filter((o) => o.socket !== socket.id);
      userss[roomID] = room;
    }
  });

  socket.on("logout", (userId) => {
    removeUser2(userId);
    io.emit("getUsers", users);
  });

  /*******For video chat */

  socket.on("join room", ({ roomID, user }) => {
    console.log("join room");
    if (userss[roomID]) {
      const length = userss[roomID].length;
      if (length === 4) {
        socket.emit("room full");
        return;
      }
      userss[roomID].push({ socket: socket.id, user: user });
    } else {
      userss[roomID] = [{ socket: socket.id, user: user }];
    }
    socketToRoom[socket.id] = roomID;
    const usersInThisRoom = userss[roomID].filter(
      (o) => o.socket !== socket.id,
    );
    console.log(usersInThisRoom);
    socket.emit("all users", usersInThisRoom);
  });

  socket.on("sending signal", (payload) => {
    console.log("SENDING SIGNAL");
    console.log(payload.userToSignal);
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
      user: payload.user,
    });
  });

  socket.on("returning signal", (payload) => {
    console.log("RETURNING SIGNAL");
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
      user: payload.user,
    });
  });

  /********for notif */
});

server.listen(PORT, () => console.log("server is running on port: " + PORT));
