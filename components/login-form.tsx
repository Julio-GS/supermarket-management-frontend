"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => router.push("/dashboard"), 700)
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              placeholder="tu@tienda.com"
              defaultValue="ana.lopez@tienda.com"
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
              type="password"
              placeholder="••••••••"
              defaultValue="demo1234"
              required
            />
          </InputGroup>
        </Field>

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

        <p className="text-center text-xs text-muted-foreground">
          Demo: usa cualquier credencial para entrar.
        </p>
      </FieldGroup>
    </form>
  )
}
