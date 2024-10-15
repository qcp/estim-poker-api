import { object, safeParse, string } from "@valibot/valibot";
import type { IRoom, IRoomId } from "./types.ts";

const storeScheme = object({ id: string(), name: string(), voteSystem: string() })
const store = await Deno.openKv();

export async function getFromStore(roomId: IRoomId): Promise<IRoom> {
  const item = await store.get(['room', roomId])
  if (!item.value)
    throw new Error(`Room "${roomId}" doesn't exist in store`)

  const validatedItem = safeParse(storeScheme, item.value)

  if (!validatedItem.success) {
    throw new Error(`Couldn't parse room ${roomId} from store`)
  }

  return validatedItem.output
}

export async function setToStore({ id, name, voteSystem }: IRoom): Promise<void> {
  try {
    await store.set(['room', id], {
      id, name, voteSystem,
      lastUsedAt: new Date().toDateString() // Дополнительно обогатим информацией о последнем использовании
    })
  } catch (ex) {
    // Do not raise an exception
    console.error(`Couldn't save room ${id} to store`, ex)
  }
}