import { object, optional, parse, string } from "@valibot/valibot";
import manager from './manager.ts';

function wsRoom(roomId: string, socket: WebSocket) {
  const userId = crypto.randomUUID()
  socket.addEventListener("open", () => {
    const room = manager.init(roomId)
    room.enter(userId, (state) => {
      socket.send(JSON.stringify(state))
    })
  });
  socket.addEventListener("close", () => {
    const room = manager.get(roomId)
    room.leave(userId)
  });
  socket.addEventListener("error", () => {
    const room = manager.get(roomId)
    room.leave(userId)
  });
  socket.addEventListener("message", (event) => {
    const room = manager.get(roomId)
    if (event.data === "ping") {
      socket.send("pong");
      room.ping(userId)
      return;
    }

    const user = parse(
      object({ name: string(), vote: optional(string()) }),
      JSON.parse(event.data)
    )
    room.sunc(userId, user)
  });
}

async function postRoom(req: Request) {
  const { id, name, voteSystem } = parse(
    object({ id: optional(string()), name: string(), voteSystem: string() }),
    await req.json()
  )

  if (id) {
    const room = manager.init(id)
    room.update({ name, voteSystem })
    return room.get()
  }
  else {
    const room = manager.create(name, voteSystem)
    return room.get()
  }
}

Deno.serve(async (req) => {
  switch (req.method) {
    case "OPTIONS":
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      })
    case "GET": {
      if (req.headers.get("upgrade") != "websocket") {
        return new Response(null, { status: 501 });
      }
      const { socket, response } = Deno.upgradeWebSocket(req);
      const roomId = new URL(req.url).pathname.replace(/^\//, '')
      wsRoom(roomId, socket)
      return response
    }
    case "POST":
      return new Response(JSON.stringify(await postRoom(req)), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      })
    default:
      return new Response(null, { status: 501 })
  }
});