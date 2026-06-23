export type UserRole = "admin" | "cashier" | "manager"

export interface User {
  id: string
  username: string
  email: string
  name: string
  role: UserRole
}
