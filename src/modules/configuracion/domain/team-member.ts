export type TeamRole = "Administradora" | "Administrador" | "Cajero" | "Cajera" | "Inventario"

export interface TeamMember {
  name: string
  email: string
  role: TeamRole
  initials: string
}
