"use client"

import { useCallback, useState } from "react"
import type { Result } from "@/shared/domain/result"
import type { AuthError } from "../domain/auth-error"
import type { Credentials } from "../domain/credentials"
import type { Session } from "../domain/session"
import type { SessionPort } from "./session-port"

export type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; session: Session }
  | { status: "error"; error: AuthError }

export function useLogin(port: SessionPort) {
  const [state, setState] = useState<LoginState>({ status: "idle" })

  const login = useCallback(
    async (credentials: Credentials): Promise<Result<Session, AuthError>> => {
      setState({ status: "loading" })
      const result = await port.login(credentials)
      if (result.success) {
        setState({ status: "success", session: result.value })
      } else {
        setState({ status: "error", error: result.error })
      }
      return result
    },
    [port]
  )

  return { state, login }
}
