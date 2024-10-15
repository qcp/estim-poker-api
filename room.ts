import { literal, object, optional, safeParse, string, variant } from "@valibot/valibot";
import { Room } from './manager.ts';

export function createWsRoom(room: Room, socket: WebSocket) {
  const userId = crypto.randomUUID()

  socket.addEventListener("open", () => {
    room.enter(userId, (state) => socket.send(JSON.stringify(state)))
    socket.send(JSON.stringify(room.get()))
  });
  socket.addEventListener("close", () => {
    room.leave(userId)
  });
  socket.addEventListener("error", () => {
    room.leave(userId)
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "ping") {
      socket.send("pong");
      room.sunc(userId, {}, true)
      return
    }
    const validatedAction = safeParse(
      variant('type', [
        object({ type: literal('toggle-results') }),
        object({ type: literal('reset-results') }),
        object({ type: literal('change-name'), name: string() }),
        object({ type: literal('change-vote'), vote: optional(string()) }),
      ]),
      JSON.parse(event.data)
    )
    if (!validatedAction.success) {
      console.warn('Broken ws payload', event.data)
      return
    }

    const action = validatedAction.output

    if (action.type === 'toggle-results') {
      room.toggleResults()
    } else if (action.type === 'reset-results') {
      room.resetResults()
    } else if (action.type === 'change-name') {
      room.sunc(userId, { name: action.name })
    } else if (action.type === 'change-vote') {
      room.sunc(userId, { vote: action.vote })
    }
  });

}