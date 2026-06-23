// Domain
export type { User, UserRole } from "./domain/user"
export type { Session } from "./domain/session"
export type { AuthError, AuthErrorCode } from "./domain/auth-error"
export type { Credentials } from "./domain/credentials"
export { validateCredentials } from "./domain/credentials"

// Application
export type { SessionPort } from "./application/session-port"
export { useLogin } from "./application/use-login"
export type { LoginState } from "./application/use-login"

// Infrastructure
export { createMockSessionAdapter } from "./infrastructure/mock-session-adapter"
export { createApiSessionAdapter } from "./infrastructure/api-session-adapter"
export { sessionAdapter } from "./infrastructure/session-adapter-instance"

// Presentation
export { RouteGuard } from "./presentation/route-guard"
export { LoginPage } from "./presentation/login-page"
