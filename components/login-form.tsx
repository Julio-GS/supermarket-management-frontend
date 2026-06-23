"use client"

import { useRouter } from "next/navigation"
import { User, Lock, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { sessionAdapter, useLogin } from "@/modules/auth"

export function LoginForm() {
  const router = useRouter()
  const { state, login } = useLogin(sessionAdapter)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const username = String(formData.get("username") ?? "")
    const password = String(formData.get("password") ?? "")

    const result = await login({ username, password })
    if (result.success) {
      router.push("/dashboard")
    }
  }

  const loading = state.status === "loading"
  const errorMessage = state.status === "error" ? state.error.message : null

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">Usuario</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <User />
            </InputGroupAddon>
            <InputGroupInput
              id="username"
              name="username"
              type="text"
              placeholder="ana.lopez"
              defaultValue="admin"
              required
            />
          </InputGroup>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <InputGroup>
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              defaultValue="admin1234"
              required
            />
          </InputGroup>
        </Field>

        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        <Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Ingresando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
