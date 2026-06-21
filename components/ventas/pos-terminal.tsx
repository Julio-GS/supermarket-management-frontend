"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Receipt,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  productos,
  categorias,
  formatoMoneda,
  type Producto,
} from "@/lib/data"

interface LineaCarrito {
  producto: Producto
  cantidad: number
}

const metodosPago = [
  { value: "Efectivo", label: "Efectivo", icon: Banknote },
  { value: "Tarjeta", label: "Tarjeta", icon: CreditCard },
  { value: "Transferencia", label: "Transferencia", icon: ArrowRightLeft },
]

export function PosTerminal() {
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState<string>("Todas")
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [metodoPago, setMetodoPago] = useState("Tarjeta")

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideTexto =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.sku.toLowerCase().includes(busqueda.toLowerCase())
      const coincideCategoria = categoria === "Todas" || p.categoria === categoria
      return coincideTexto && coincideCategoria
    })
  }, [busqueda, categoria])

  function agregar(producto: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto.id === producto.id)
      if (existente) {
        return prev.map((l) =>
          l.producto.id === producto.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l,
        )
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) =>
          l.producto.id === id
            ? { ...l, cantidad: Math.max(0, l.cantidad + delta) }
            : l,
        )
        .filter((l) => l.cantidad > 0),
    )
  }

  function quitar(id: string) {
    setCarrito((prev) => prev.filter((l) => l.producto.id !== id))
  }

  const subtotal = carrito.reduce(
    (acc, l) => acc + l.producto.precio * l.cantidad,
    0,
  )
  const iva = subtotal * 0.1
  const total = subtotal + iva

  function cobrar() {
    if (carrito.length === 0) return
    toast.success("Venta registrada", {
      description: `Total ${formatoMoneda(total)} pagado con ${metodoPago.toLowerCase()}.`,
    })
    setCarrito([])
  }

  return (
    <>
      <PageHeader
        title="Punto de venta"
        description="Registra ventas y cobra a tus clientes"
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Receipt className="size-3.5" />
            Ticket V-10429
          </Badge>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_380px]">
        {/* Catálogo */}
        <div className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar producto o SKU..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </InputGroup>

          <ScrollArea className="w-full whitespace-nowrap">
            <ToggleGroup
              type="single"
              value={categoria}
              onValueChange={(v) => v && setCategoria(v)}
              variant="outline"
              className="w-max"
            >
              <ToggleGroupItem value="Todas">Todas</ToggleGroupItem>
              {categorias.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ScrollArea>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {productosFiltrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => agregar(p)}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium leading-tight">
                    {p.nombre}
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{p.categoria}</span>
                <span className="mt-auto text-base font-semibold text-primary">
                  {formatoMoneda(p.precio)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    /{p.unidad}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carrito */}
        <Card className="flex h-fit flex-col lg:sticky lg:top-24">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <ShoppingCart className="size-4" />
                Carrito
              </div>
              <Badge variant="secondary">{carrito.length} ítems</Badge>
            </div>

            <Separator />

            {carrito.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingCart />
                  </EmptyMedia>
                  <EmptyTitle>Carrito vacío</EmptyTitle>
                  <EmptyDescription>
                    Selecciona productos del catálogo para empezar.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="max-h-[40vh]">
                <div className="flex flex-col gap-3 pr-2">
                  {carrito.map((l) => (
                    <div key={l.producto.id} className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {l.producto.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatoMoneda(l.producto.precio)} c/u
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => cambiarCantidad(l.producto.id, -1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">
                          {l.cantidad}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => cambiarCantidad(l.producto.id, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold">
                        {formatoMoneda(l.producto.precio * l.cantidad)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground"
                        onClick={() => quitar(l.producto.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Separator />

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatoMoneda(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (10%)</span>
                <span>{formatoMoneda(iva)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatoMoneda(total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Método de pago
              </span>
              <ToggleGroup
                type="single"
                value={metodoPago}
                onValueChange={(v) => v && setMetodoPago(v)}
                variant="outline"
                className="grid grid-cols-3"
              >
                {metodosPago.map((m) => (
                  <ToggleGroupItem
                    key={m.value}
                    value={m.value}
                    className="flex-col gap-1 py-2 text-xs"
                  >
                    <m.icon className="size-4" />
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={carrito.length === 0}
              onClick={cobrar}
            >
              Cobrar {formatoMoneda(total)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
