export type UserRole = "admin" | "cashier" | "manager"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}
