import { flatten, object, optional, safeParse, string } from "@valibot/valibot";
import { corsHeaders } from "./constants.ts";
import { createWsRoom } from "./room.ts";
import { createRoom, getFullRoom, isRoomExist, updateRoom } from "./store.ts";

function newResponce(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...corsHeaders,
    },
  });
}

async function getRoom(req: Request): Promise<Response> {
  if (req.headers.get("upgrade") != "websocket") {
    return Response.redirect("https://qcp.github.io/estim-poker", 301);
  }

  const roomId = new URL(req.url).pathname.replace(/^\//, "");
  const isExist = await isRoomExist(roomId);

  if (isExist) {
    const { socket, response } = Deno.upgradeWebSocket(req);
    createWsRoom(roomId, socket);
    return response;
  } else {
    return newResponce(400, {
      message: `Couldn't init room`,
    });
  }
}

async function postRoom(req: Request): Promise<Response> {
  const validatedBody = safeParse(
    object({ id: optional(string()), name: string(), voteSystem: string() }),
    await req.json(),
  );

  if (!validatedBody.success) {
    return newResponce(400, {
      message: `Couldn't parse body params`,
      issues: flatten(validatedBody.issues),
    });
  }

  const { id, name, voteSystem } = validatedBody.output;

  const roomId = id
    ? await updateRoom(id, (room) => ({ ...room, name, voteSystem }))
    : await createRoom(name, voteSystem);

  const room = await getFullRoom(roomId);

  return newResponce(200, room);
}

async function handleRequest(req: Request): Promise<Response> {
  switch (req.method) {
    case "OPTIONS":
      return new Response(null, { status: 200, headers: corsHeaders });
    case "GET":
      return await getRoom(req);
    case "POST":
      return await postRoom(req);
    default:
      return new Response(null, { status: 501, headers: corsHeaders });
  }
}

Deno.serve(handleRequest);
