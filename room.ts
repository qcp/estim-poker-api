import { object, optional, parse, string } from "@valibot/valibot";
import manager from './manager.ts';
import { corsHeaders } from "./constants.ts";

async function wsRoom(roomId: string, socket: WebSocket) {
  const room = await manager.init(roomId)
  const userId = crypto.randomUUID()

  socket.addEventListener("open", () => {
    room.enter(userId, (state) => {
      socket.send(JSON.stringify(state))
    })
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

export async function getRoom(req: Request): Promise<Response> {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, { status: 501 });
  }
  const { socket, response } = Deno.upgradeWebSocket(req);

  const roomId = new URL(req.url).pathname.replace(/^\//, '')
  await wsRoom(roomId, socket)
  
  return response
}

export async function postRoom(req: Request): Promise<Response> {
  const { id, name, voteSystem } = parse(
    object({ id: optional(string()), name: string(), voteSystem: string() }),
    await req.json()
  )

  let room: ReturnType<typeof manager.get>
  if (id) {
    room = await manager.init(id)
    room.update({ name, voteSystem })
  }
  else {
    room = manager.create(name, voteSystem)
  }

  return new Response(
    JSON.stringify(room.get()),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        ...corsHeaders
      }
    }
  )
}