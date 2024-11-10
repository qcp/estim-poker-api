import {
  boolean,
  object,
  optional,
  parse,
  safeParse,
  string,
} from "@valibot/valibot";

type IRoomId = string;
type IRoomData = {
  name: string;
  voteSystem: string;
  showResults: boolean;
};
const RoomScheme = object({
  name: string(),
  voteSystem: string(),
  showResults: boolean(),
});

const store = await Deno.openKv();

async function updateRefreshFlag(roomId: IRoomId) {
  await store.set(["room_v2", roomId, "refresh"], new Date().toISOString());
}

export async function isRoomExist(roomId: IRoomId) {
  const rItem = await store.get(["room_v2", roomId]);

  return !!rItem.value;
}

export async function createRoom(name: string, voteSystem: string) {
  const newId = crypto.randomUUID();

  await store.set(["room_v2", newId], {
    name,
    voteSystem,
    showResults: false,
  });

  await updateRefreshFlag(newId);

  return newId;
}

export async function updateRoom(
  roomId: IRoomId,
  updater: (room: IRoomData) => IRoomData,
) {
  const key = ["room_v2", roomId];
  const item = await store.get(key);
  const room = parse(RoomScheme, item.value);

  await store.set(key, updater(room));

  await updateRefreshFlag(roomId);

  return roomId;
}

type IUserId = string;
type IUserData = {
  name: string;
  vote?: string;
};
const UserScheme = object({
  name: string(),
  vote: optional(string()),
});

const userExpiration = { expireIn: 60 * 1000 };

export async function syncRoomUser(
  roomId: IRoomId,
  userId: IUserId,
  updater: (user: IUserData) => IUserData,
) {
  const key = ["room_v2", roomId, "user", userId];
  const item = await store.get(key);
  // Fallback if it's user creation
  const user = item.value ? parse(UserScheme, item.value) : { name: "🤡" };

  await store.set(key, updater(user), userExpiration);

  await updateRefreshFlag(roomId);
}

export async function killRoomUser(roomId: IRoomId, userId: IUserId) {
  await store.delete(["room_v2", roomId, "user", userId]);

  await updateRefreshFlag(roomId);
}

export async function resetAllUserVotes(roomId: IRoomId) {
  for await (
    const item of store.list({ prefix: ["room_v2", roomId, "user"] })
  ) {
    const { success, output: user } = safeParse(UserScheme, item.value);
    if (success) {
      await store.set(item.key, { ...user, vote: undefined }, userExpiration);
    }
  }
  await updateRefreshFlag(roomId);
}

export async function getFullRoom(roomId: IRoomId) {
  const rItem = await store.get(["room_v2", roomId]);
  const room = parse(RoomScheme, rItem.value);

  const users: Array<IUserData & { id: string }> = [];
  for await (
    const uItem of store.list({ prefix: ["room_v2", roomId, "user"] })
  ) {
    const { success, output: user } = safeParse(UserScheme, uItem.value);
    if (success) {
      users.push({
        id: uItem.key.at(3)?.toString() ?? "🤡",
        ...user,
      });
    }
  }

  return {
    id: roomId,
    ...room,
    users,
  };
}

export async function* watchRoom(roomId: IRoomId) {
  for await (const [msg] of store.watch([["room_v2", roomId, "refresh"]])) {
    yield msg.value;
  }
}
