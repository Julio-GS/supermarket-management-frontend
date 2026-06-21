"use client"

import { useState } from "react"
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

const equipo = [
  { nombre: "Ana López", email: "ana@supergestion.com", rol: "Administradora", iniciales: "AL" },
  { nombre: "Carlos Ruiz", email: "carlos@supergestion.com", rol: "Cajero", iniciales: "CR" },
  { nombre: "Marta Gil", email: "marta@supergestion.com", rol: "Cajera", iniciales: "MG" },
  { nombre: "Pedro Sanz", email: "pedro@supergestion.com", rol: "Inventario", iniciales: "PS" },
]

export function SettingsTabs() {
  const [stockAlerts, setStockAlerts] = useState(true)
  const [dailyReport, setDailyReport] = useState(true)
  const [promoEmails, setPromoEmails] = useState(false)

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
            <CardDescription>
              Esta información aparece en tickets y reportes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nombre-tienda">Nombre del supermercado</FieldLabel>
                <Input id="nombre-tienda" defaultValue="SuperGestión Central" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cif">CIF / NIF</FieldLabel>
                  <Input id="cif" defaultValue="B-12345678" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                  <Input id="telefono" defaultValue="+34 912 345 678" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
                <Input id="direccion" defaultValue="Calle Mayor 45, 28013 Madrid" />
                <FieldDescription>
                  Dirección física que se imprime en los recibos.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => toast.success("Datos de la tienda guardados.")}>
              Guardar cambios
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="equipo">
        <Card>
          <CardHeader>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Personas con acceso al sistema de gestión.
            </CardDescription>
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
                {equipo.map((m) => (
                  <TableRow key={m.email}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback>{m.iniciales}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{m.nombre}</span>
                          <span className="text-sm text-muted-foreground">{m.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.rol === "Administradora" ? "default" : "secondary"}>
                        {m.rol}
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
            <CardDescription>
              Elige qué alertas quieres recibir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="font-medium">Alertas de stock bajo</span>
                <span className="text-sm text-muted-foreground">
                  Recibe un aviso cuando un producto llegue a su nivel mínimo.
                </span>
              </div>
              <Switch checked={stockAlerts} onCheckedChange={setStockAlerts} />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="font-medium">Reporte diario de ventas</span>
                <span className="text-sm text-muted-foreground">
                  Un resumen del cierre de caja cada noche.
                </span>
              </div>
              <Switch checked={dailyReport} onCheckedChange={setDailyReport} />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="font-medium">Correos promocionales</span>
                <span className="text-sm text-muted-foreground">
                  Novedades y consejos del producto SuperGestión.
                </span>
              </div>
              <Switch checked={promoEmails} onCheckedChange={setPromoEmails} />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => toast.success("Preferencias actualizadas.")}>
              Guardar preferencias
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
