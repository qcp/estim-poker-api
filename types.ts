export type IRoomId = string
/** Room stored data */
export type IRoom = {
  id: IRoomId
  name: string
  voteSystem: string
}

export type IUserId = string
/** User data */
export type IUser = {
  id: IUserId,
  name: string
  vote?: string
  lastSeenAt: Date
}

/** Extended room data */
export type IRoomExt = IRoom & {
  showResults: boolean
  users: Array<IUser>
}
