import {
  flatten,
  literal,
  object,
  optional,
  safeParse,
  string,
  variant,
} from "@valibot/valibot";
import {
  getFullRoom,
  killRoomUser,
  resetAllUserVotes,
  syncRoomUser,
  updateRoom,
  watchRoom,
} from "./store.ts";

export function createWsRoom(roomId: string, socket: WebSocket) {
  const userId = crypto.randomUUID();

  socket.addEventListener("open", async () => {
    for await (const _ of watchRoom(roomId)) {
      const room = await getFullRoom(roomId);

      switch (socket.readyState) {
        case socket.OPEN:
          socket.send(JSON.stringify({ ...room, userId }));
          break;
        case socket.CLOSED:
          return;
      }
    }
  });
  socket.addEventListener("close", () => {
    killRoomUser(roomId, userId);
  });
  socket.addEventListener("error", () => {
    killRoomUser(roomId, userId);
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "ping") {
      socket.send("pong");
      return;
    }

    let jsonData: Record<string, unknown>;
    try {
      jsonData = JSON.parse(event.data);
    } catch (ex) {
      console.error(`Couldn't parsed incoming message`, event.data, ex);
      return;
    }

    const validatedAction = safeParse(
      variant("type", [
        object({ type: literal("toggle-results") }),
        object({ type: literal("reset-results") }),
        object({ type: literal("change-name"), name: string() }),
        object({ type: literal("change-vote"), vote: optional(string()) }),
      ]),
      jsonData,
    );
    if (!validatedAction.success) {
      console.warn("Broken ws payload", flatten(validatedAction.issues));
      return;
    }

    const action = validatedAction.output;

    if (action.type === "toggle-results") {
      updateRoom(
        roomId,
        (room) => ({ ...room, showResults: !room.showResults }),
      );
    } else if (action.type === "reset-results") {
      resetAllUserVotes(roomId);
    } else if (action.type === "change-name") {
      syncRoomUser(roomId, userId, (user) => ({ ...user, name: action.name }));
    } else if (action.type === "change-vote") {
      syncRoomUser(roomId, userId, (user) => ({ ...user, vote: action.vote }));
    }
  });
}
