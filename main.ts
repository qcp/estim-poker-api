
import { flatten, object, optional, safeParse, string } from "@valibot/valibot";
import { corsHeaders } from "./constants.ts";
import type { Room } from "./manager.ts";
import manager from "./manager.ts";
import { createWsRoom } from "./room.ts";

function newResponce(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...corsHeaders
    }
  })
}

export function getRoom(req: Request): Response {
  if (req.headers.get("upgrade") != "websocket") {
    return Response.redirect('https://qcp.github.io/estim-poker', 301)
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const roomId = new URL(req.url).pathname.replace(/^\//, '')

  // Strictly won't wait, init must perform after returning response
  manager.init(roomId)
    .then((room) => createWsRoom(room, socket))
    .catch((ex) => {
      console.warn(ex)
      // https://github.com/denoland/deno/issues/21642
      socket.close(4400, `Couldn't init room`)
    }) 

  return response
}

export async function postRoom(req: Request): Promise<Response> {
  const validatedBody = safeParse(
    object({ id: optional(string()), name: string(), voteSystem: string() }),
    await req.json()
  )

  if (!validatedBody.success) {
    return newResponce(400, {
      message: `Couldn't parse body params`,
      issues: flatten(validatedBody.issues)
    })
  }

  const { id, name, voteSystem } = validatedBody.output
  let room: Room
  if (id) {
    try {
      room = await manager.init(id)
      room.update({ name, voteSystem })
    } catch (ex) {
      console.warn(ex)
      return newResponce(400, {
        message: `Couldn't init room`,
        error: ex
      })
    }
  }
  else {
    room = manager.create(name, voteSystem)
  }

  return newResponce(200, room.get())
}

async function handleRequest(req: Request): Promise<Response> {
  switch (req.method) {
    case "OPTIONS":
      return new Response(null, { status: 200, headers: corsHeaders })
    case "GET":
      return getRoom(req)
    case "POST":
      return await postRoom(req)
    default:
      return new Response(null, { status: 501, headers: corsHeaders })
  }
}

Deno.serve(handleRequest);