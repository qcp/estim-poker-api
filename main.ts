import { ValiError } from "@valibot/valibot";
import { getRoom, postRoom } from "./room.ts";
import { corsHeaders } from "./constants.ts";

async function handleRequest(req: Request): Promise<Response> {
  switch (req.method) {
    case "OPTIONS":
      return new Response(null, { status: 200, headers: corsHeaders })
    case "GET":
      return await getRoom(req)
    case "POST":
      return await postRoom(req)
    default:
      return new Response(null, { status: 501 })
  }
}

function handleError(ex: unknown) {
  if (ex instanceof ValiError) {
    return new Response(JSON.stringify(ex.issues), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        ...corsHeaders
      }
    })
  }
  else if (ex instanceof Error) {
    return new Response(ex.message, { status: 500, headers: corsHeaders })
  }
  else {
    return new Response(String(ex), { status: 500, headers: corsHeaders })
  }
}

Deno.serve((req) => handleRequest(req).catch(handleError));