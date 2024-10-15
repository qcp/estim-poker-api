import { getFromStore, setToStore } from "./store.ts";
import type { IRoomId, IUserId, IUser, IRoomExt, IRoom } from "./types.ts";

class Manager {
  // store = useStorage<IRoom>('room');
  private manager = new Map<IRoomId, Room>()

  private register(room: Room) {
    // Зарегистрирум в менеджере
    this.manager.set(room.id, room)

    // Сохраним в сторе
    setToStore(room.get())

    return room
  }

  async init(roomId: IRoomId) {
    // Проверим что комната уже зарегестрированна (после создания или первого входа)
    const roomFromManager = this.manager.get(roomId) // не используем this.get т.к. он в случае отсутствия срыгнёт ошибку
    if (roomFromManager)
      return roomFromManager

    // Если комната не инициализированна, проверим её наличие в сторе
    const roomFromStore = await getFromStore(roomId)

    const { id, name, voteSystem } = roomFromStore
    const room = new Room(id, name, voteSystem)

    return this.register(room)
  }

  create(name: string, voteSystem: string) {
    const id = crypto.randomUUID()
    const room = new Room(id, name, voteSystem)

    return this.register(room)
  }
}

export class Room {
  id: IRoomId
  name: string
  voteSystem: string
  showResults: boolean = false

  constructor(id: IRoomId, name: string, voteSystem: string) {
    this.id = id
    this.name = name
    this.voteSystem = voteSystem
  }

  private users: Map<IUserId, IUser> = new Map()

  private listeners: Map<IUserId, (room: IRoomExt) => void> = new Map()
  private emitUpdate() {
    for (const [, fn] of this.listeners)
      fn(this.get())
  }

  get(): IRoomExt {
    return {
      id: this.id,
      name: this.name,
      voteSystem: this.voteSystem,
      showResults: this.showResults,
      users: this.users.values().toArray()
    }
  }
  update(room: Pick<IRoom, 'name' | 'voteSystem'>) {
    this.name = room.name
    this.voteSystem = room.voteSystem
    setToStore(this.get())
    this.emitUpdate()
  }
  sunc(userId: IUserId, params: Partial<Pick<IUser, 'name' | 'vote'>>, silent = false) {
    const user = this.users.get(userId) ?? { id: userId, name: '🤡' }
    this.users.set(userId, {
      ...user,
      ...params,
      lastSeenAt: new Date()
    })
    if (!silent)
      this.emitUpdate()
  }
  toggleResults() {
    this.showResults = !this.showResults
    this.emitUpdate()
  }
  resetResults() {
    for (const user of this.users.values()) {
      user.vote = undefined
    }
    this.emitUpdate()
  }
  enter(userId: IUserId, onUpdate: (room: IRoomExt) => void) {
    this.listeners.set(userId, onUpdate)
  }
  leave(userId: IUserId) {
    this.users.delete(userId)
    this.listeners.delete(userId)

    if (this.listeners.size > 0)
      this.emitUpdate()
  }
}

const manager = new Manager()
export default manager