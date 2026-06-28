"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { MoreHorizontal } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SettingsRepository } from "../application/settings-repository"
import { useSettings } from "../application/use-settings"
import type { StoreProfile } from "../domain/store-profile"
import type { NotificationPrefs } from "../domain/notification-prefs"

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

function NotificationForm({
  prefs,
  onSave,
}: {
  prefs: NotificationPrefs
  onSave: (prefs: NotificationPrefs) => Promise<void>
}) {
  const lowStockRef = useRef<HTMLInputElement>(null)
  const dailyReportRef = useRef<HTMLInputElement>(null)
  const promotionalRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({
      lowStockAlerts: lowStockRef.current?.checked ?? false,
      dailyReport: dailyReportRef.current?.checked ?? false,
      promotionalEmails: promotionalRef.current?.checked ?? false,
    })
    toast.success("Preferencias actualizadas.")
  }

  return (
    <form id="notification-form" onSubmit={handleSubmit} className="contents">
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5 pr-4">
          <span className="font-medium">Alertas de stock bajo</span>
          <span className="text-sm text-muted-foreground">
            Recibe un aviso cuando un producto llegue a su nivel mínimo.
          </span>
        </div>
        <span className="sr-only">
          <input
            ref={lowStockRef}
            type="checkbox"
            name="lowStockAlerts"
            defaultChecked={prefs.lowStockAlerts}
            aria-label="Alertas de stock bajo"
          />
        </span>
        <Switch
          aria-label="Alertas de stock bajo"
          defaultChecked={prefs.lowStockAlerts}
          onCheckedChange={(checked) => {
            if (lowStockRef.current) {
              lowStockRef.current.checked = checked
            }
          }}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5 pr-4">
          <span className="font-medium">Reporte diario de ventas</span>
          <span className="text-sm text-muted-foreground">
            Un resumen del cierre de caja cada noche.
          </span>
        </div>
        <span className="sr-only">
          <input
            ref={dailyReportRef}
            type="checkbox"
            name="dailyReport"
            defaultChecked={prefs.dailyReport}
            aria-label="Reporte diario de ventas"
          />
        </span>
        <Switch
          aria-label="Reporte diario de ventas"
          defaultChecked={prefs.dailyReport}
          onCheckedChange={(checked) => {
            if (dailyReportRef.current) {
              dailyReportRef.current.checked = checked
            }
          }}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5 pr-4">
          <span className="font-medium">Correos promocionales</span>
          <span className="text-sm text-muted-foreground">
            Novedades y consejos del producto SuperGestión.
          </span>
        </div>
        <span className="sr-only">
          <input
            ref={promotionalRef}
            type="checkbox"
            name="promotionalEmails"
            defaultChecked={prefs.promotionalEmails}
            aria-label="Correos promocionales"
          />
        </span>
        <Switch
          aria-label="Correos promocionales"
          defaultChecked={prefs.promotionalEmails}
          onCheckedChange={(checked) => {
            if (promotionalRef.current) {
              promotionalRef.current.checked = checked
            }
          }}
        />
      </div>
    </form>
  )
}

export function SettingsTabs({ repository }: SettingsTabsProps) {
  const { profile, members, notificationPrefs, load, updateProfile, updateNotificationPrefs } =
    useSettings(repository)

  useEffect(() => {
    load()
  }, [load])

  return (
    <Tabs defaultValue="tienda" className="gap-6">
      <TabsList>
        <TabsTrigger value="tienda">Tienda</TabsTrigger>
        <TabsTrigger value="equipo">Equipo</TabsTrigger>
        <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
      </TabsList>

      <TabsContent value="tienda">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la tienda</CardTitle>
            <CardDescription>Esta información aparece en tickets y reportes.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile ? <StoreForm profile={profile} onSave={updateProfile} /> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" form="store-form">
              Guardar cambios
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="equipo">
        <Card>
          <CardHeader>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>Personas con acceso al sistema de gestión.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.email}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback>{member.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{member.name}</span>
                          <span className="text-sm text-muted-foreground">{member.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === "Administradora" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontal />
                          <span className="sr-only">Acciones</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => toast.info("Editar miembro")}>
                              Editar permisos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => toast.info("Acceso revocado")}
                            >
                              Revocar acceso
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant="outline" onClick={() => toast.info("Invitación enviada.")}>
              Invitar miembro
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="notificaciones">
        <Card>
          <CardHeader>
            <CardTitle>Preferencias de notificaciones</CardTitle>
            <CardDescription>Elige qué alertas quieres recibir.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {notificationPrefs ? (
              <NotificationForm prefs={notificationPrefs} onSave={updateNotificationPrefs} />
            ) : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" form="notification-form">
              Guardar preferencias
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
