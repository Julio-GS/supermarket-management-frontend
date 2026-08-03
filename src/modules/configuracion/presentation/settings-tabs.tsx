"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { merchantFiscalIdentity } from "@/shared/config/merchant-fiscal-identity"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import type { SettingsRepository } from "../application/settings-repository"
import { useSettings } from "../application/use-settings"
import type { StoreProfile } from "../domain/store-profile"

export interface SettingsTabsProps {
  repository: SettingsRepository
}

function StoreForm({
  profile,
  onSave,
}: {
  profile: StoreProfile
  onSave: (profile: StoreProfile) => Promise<void>
}) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await onSave({
      name: String(formData.get("name")),
      taxId: String(formData.get("taxId")),
      phone: String(formData.get("phone")),
      address: String(formData.get("address")),
    })
    toast.success("Datos de la tienda guardados.")
  }

  return (
    <form id="store-form" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nombre-tienda">Nombre del supermercado</FieldLabel>
          <Input id="nombre-tienda" name="name" defaultValue={profile.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="cif">CIF / NIF</FieldLabel>
            <Input id="cif" name="taxId" defaultValue={profile.taxId} />
          </Field>
          <Field>
            <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
            <Input id="telefono" name="phone" defaultValue={profile.phone} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
          <Input id="direccion" name="address" defaultValue={profile.address} />
          <FieldDescription>Dirección física que se imprime en los recibos.</FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}

function FiscalIdentitySection() {
  const fiscalRows = [
    { label: "Razón social", value: merchantFiscalIdentity.legalName },
    { label: "Nombre comercial", value: merchantFiscalIdentity.tradeName },
    { label: "CUIT", value: merchantFiscalIdentity.cuit },
    { label: "Ingresos Brutos", value: merchantFiscalIdentity.grossIncomeNumber },
    { label: "Condición frente al IVA", value: merchantFiscalIdentity.ivaCondition },
    { label: "Punto de venta", value: merchantFiscalIdentity.pointOfSale },
    { label: "Inicio de actividades", value: merchantFiscalIdentity.activityStartDate },
    { label: "Actividad", value: merchantFiscalIdentity.activity },
    { label: "Domicilio fiscal", value: merchantFiscalIdentity.taxOfficeAddress },
  ]

  return (
    <div className="mt-6 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identidad fiscal actual
        </h3>
        <p className="text-sm text-muted-foreground">
          Estos datos alimentan el ticket fiscal impreso actualmente.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fiscalRows.map((row) => (
          <div
            key={row.label}
            className="space-y-1 rounded-md border border-border/60 bg-background p-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <p className="text-sm font-medium text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SettingsTabs({ repository }: SettingsTabsProps) {
  const { profile, load, updateProfile } = useSettings(repository)

  useEffect(() => {
    load()
  }, [load])

  return (
    <Tabs defaultValue="tienda" className="gap-6">
      <TabsList>
        <TabsTrigger value="tienda">Tienda</TabsTrigger>
      </TabsList>

      <TabsContent value="tienda">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la tienda</CardTitle>
            <CardDescription>Esta información aparece en tickets y reportes.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile ? <StoreForm profile={profile} onSave={updateProfile} /> : null}
            <FiscalIdentitySection />
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" form="store-form">
              Guardar cambios
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
