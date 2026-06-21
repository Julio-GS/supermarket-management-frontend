export type Categoria =
  | "Frutas y Verduras"
  | "Lácteos"
  | "Carnes"
  | "Panadería"
  | "Bebidas"
  | "Limpieza"
  | "Despensa"
  | "Congelados"

export interface Producto {
  id: string
  nombre: string
  categoria: Categoria
  sku: string
  precio: number
  costo: number
  stock: number
  stockMinimo: number
  unidad: string
  proveedor: string
}

export interface ItemVenta {
  producto: Producto
  cantidad: number
}

export interface Venta {
  id: string
  fecha: string
  cliente: string
  items: { nombre: string; cantidad: number; precio: number }[]
  total: number
  metodoPago: "Efectivo" | "Tarjeta" | "Transferencia"
  cajero: string
}

export const categorias: Categoria[] = [
  "Frutas y Verduras",
  "Lácteos",
  "Carnes",
  "Panadería",
  "Bebidas",
  "Limpieza",
  "Despensa",
  "Congelados",
]

export const productos: Producto[] = [
  { id: "P001", nombre: "Manzana Roja", categoria: "Frutas y Verduras", sku: "FRV-0001", precio: 1.2, costo: 0.7, stock: 320, stockMinimo: 50, unidad: "kg", proveedor: "Frutas del Valle" },
  { id: "P002", nombre: "Plátano", categoria: "Frutas y Verduras", sku: "FRV-0002", precio: 0.95, costo: 0.5, stock: 18, stockMinimo: 40, unidad: "kg", proveedor: "Frutas del Valle" },
  { id: "P003", nombre: "Tomate", categoria: "Frutas y Verduras", sku: "FRV-0003", precio: 1.8, costo: 1.0, stock: 95, stockMinimo: 30, unidad: "kg", proveedor: "Huerta Local" },
  { id: "P004", nombre: "Leche Entera 1L", categoria: "Lácteos", sku: "LAC-0011", precio: 1.1, costo: 0.75, stock: 240, stockMinimo: 60, unidad: "u", proveedor: "Lácteos San José" },
  { id: "P005", nombre: "Yogur Natural 500g", categoria: "Lácteos", sku: "LAC-0012", precio: 1.5, costo: 0.9, stock: 12, stockMinimo: 25, unidad: "u", proveedor: "Lácteos San José" },
  { id: "P006", nombre: "Queso Manchego 250g", categoria: "Lácteos", sku: "LAC-0013", precio: 4.5, costo: 2.8, stock: 64, stockMinimo: 20, unidad: "u", proveedor: "Quesería Aurora" },
  { id: "P007", nombre: "Pechuga de Pollo", categoria: "Carnes", sku: "CAR-0021", precio: 6.2, costo: 4.0, stock: 80, stockMinimo: 25, unidad: "kg", proveedor: "Avícola Norte" },
  { id: "P008", nombre: "Carne Molida Res", categoria: "Carnes", sku: "CAR-0022", precio: 7.8, costo: 5.2, stock: 6, stockMinimo: 20, unidad: "kg", proveedor: "Cárnicos del Sur" },
  { id: "P009", nombre: "Pan de Molde", categoria: "Panadería", sku: "PAN-0031", precio: 2.1, costo: 1.1, stock: 130, stockMinimo: 40, unidad: "u", proveedor: "Horno Dorado" },
  { id: "P010", nombre: "Baguette", categoria: "Panadería", sku: "PAN-0032", precio: 1.4, costo: 0.6, stock: 75, stockMinimo: 30, unidad: "u", proveedor: "Horno Dorado" },
  { id: "P011", nombre: "Agua Mineral 1.5L", categoria: "Bebidas", sku: "BEB-0041", precio: 0.85, costo: 0.4, stock: 420, stockMinimo: 100, unidad: "u", proveedor: "Manantial Claro" },
  { id: "P012", nombre: "Refresco Cola 2L", categoria: "Bebidas", sku: "BEB-0042", precio: 2.3, costo: 1.3, stock: 210, stockMinimo: 80, unidad: "u", proveedor: "Distribuidora Andes" },
  { id: "P013", nombre: "Jugo de Naranja 1L", categoria: "Bebidas", sku: "BEB-0043", precio: 2.6, costo: 1.5, stock: 9, stockMinimo: 30, unidad: "u", proveedor: "Frutas del Valle" },
  { id: "P014", nombre: "Detergente 3kg", categoria: "Limpieza", sku: "LIM-0051", precio: 8.9, costo: 5.5, stock: 60, stockMinimo: 15, unidad: "u", proveedor: "QuímicaPro" },
  { id: "P015", nombre: "Papel Higiénico 12u", categoria: "Limpieza", sku: "LIM-0052", precio: 6.5, costo: 3.8, stock: 140, stockMinimo: 40, unidad: "u", proveedor: "Celulosa Plus" },
  { id: "P016", nombre: "Arroz 1kg", categoria: "Despensa", sku: "DES-0061", precio: 1.7, costo: 1.0, stock: 300, stockMinimo: 80, unidad: "u", proveedor: "Granos del Campo" },
  { id: "P017", nombre: "Aceite de Oliva 1L", categoria: "Despensa", sku: "DES-0062", precio: 9.4, costo: 6.2, stock: 48, stockMinimo: 20, unidad: "u", proveedor: "Olivar Real" },
  { id: "P018", nombre: "Pasta Espagueti 500g", categoria: "Despensa", sku: "DES-0063", precio: 1.3, costo: 0.7, stock: 4, stockMinimo: 50, unidad: "u", proveedor: "Granos del Campo" },
  { id: "P019", nombre: "Helado Vainilla 1L", categoria: "Congelados", sku: "CON-0071", precio: 4.2, costo: 2.5, stock: 70, stockMinimo: 20, unidad: "u", proveedor: "FríoMax" },
  { id: "P020", nombre: "Verduras Mixtas 1kg", categoria: "Congelados", sku: "CON-0072", precio: 3.1, costo: 1.8, stock: 55, stockMinimo: 20, unidad: "u", proveedor: "FríoMax" },
]

export const ventasRecientes: Venta[] = [
  { id: "V-10428", fecha: "2026-06-21 14:32", cliente: "Mostrador", cajero: "Ana López", metodoPago: "Tarjeta", total: 42.6, items: [{ nombre: "Pechuga de Pollo", cantidad: 2, precio: 6.2 }, { nombre: "Arroz 1kg", cantidad: 3, precio: 1.7 }, { nombre: "Aceite de Oliva 1L", cantidad: 1, precio: 9.4 }, { nombre: "Leche Entera 1L", cantidad: 4, precio: 1.1 }] },
  { id: "V-10427", fecha: "2026-06-21 14:18", cliente: "Mostrador", cajero: "Carlos Ruiz", metodoPago: "Efectivo", total: 12.85, items: [{ nombre: "Pan de Molde", cantidad: 2, precio: 2.1 }, { nombre: "Manzana Roja", cantidad: 3, precio: 1.2 }, { nombre: "Refresco Cola 2L", cantidad: 2, precio: 2.3 }] },
  { id: "V-10426", fecha: "2026-06-21 13:55", cliente: "Restaurante La Plaza", cajero: "Ana López", metodoPago: "Transferencia", total: 156.3, items: [{ nombre: "Carne Molida Res", cantidad: 10, precio: 7.8 }, { nombre: "Tomate", cantidad: 15, precio: 1.8 }, { nombre: "Queso Manchego 250g", cantidad: 11, precio: 4.5 }] },
  { id: "V-10425", fecha: "2026-06-21 13:40", cliente: "Mostrador", cajero: "Marta Gil", metodoPago: "Tarjeta", total: 28.4, items: [{ nombre: "Detergente 3kg", cantidad: 1, precio: 8.9 }, { nombre: "Papel Higiénico 12u", cantidad: 2, precio: 6.5 }, { nombre: "Agua Mineral 1.5L", cantidad: 6, precio: 0.85 }] },
  { id: "V-10424", fecha: "2026-06-21 13:12", cliente: "Mostrador", cajero: "Carlos Ruiz", metodoPago: "Efectivo", total: 9.6, items: [{ nombre: "Baguette", cantidad: 2, precio: 1.4 }, { nombre: "Yogur Natural 500g", cantidad: 2, precio: 1.5 }, { nombre: "Plátano", cantidad: 4, precio: 0.95 }] },
  { id: "V-10423", fecha: "2026-06-21 12:48", cliente: "Mostrador", cajero: "Marta Gil", metodoPago: "Tarjeta", total: 64.2, items: [{ nombre: "Helado Vainilla 1L", cantidad: 3, precio: 4.2 }, { nombre: "Verduras Mixtas 1kg", cantidad: 4, precio: 3.1 }, { nombre: "Jugo de Naranja 1L", cantidad: 5, precio: 2.6 }] },
  { id: "V-10422", fecha: "2026-06-21 12:30", cliente: "Cafetería Sol", cajero: "Ana López", metodoPago: "Transferencia", total: 98.75, items: [{ nombre: "Leche Entera 1L", cantidad: 24, precio: 1.1 }, { nombre: "Pan de Molde", cantidad: 12, precio: 2.1 }] },
  { id: "V-10421", fecha: "2026-06-21 12:05", cliente: "Mostrador", cajero: "Carlos Ruiz", metodoPago: "Efectivo", total: 18.3, items: [{ nombre: "Pasta Espagueti 500g", cantidad: 4, precio: 1.3 }, { nombre: "Tomate", cantidad: 3, precio: 1.8 }, { nombre: "Aceite de Oliva 1L", cantidad: 1, precio: 9.4 }] },
]

export const ventasPorDia = [
  { dia: "Lun", ventas: 3240, transacciones: 182 },
  { dia: "Mar", ventas: 2980, transacciones: 165 },
  { dia: "Mié", ventas: 3620, transacciones: 201 },
  { dia: "Jue", ventas: 4120, transacciones: 228 },
  { dia: "Vie", ventas: 5380, transacciones: 297 },
  { dia: "Sáb", ventas: 6890, transacciones: 372 },
  { dia: "Dom", ventas: 4510, transacciones: 246 },
]

export const ventasPorCategoria = [
  { categoria: "Frutas y Verduras", total: 8420 },
  { categoria: "Lácteos", total: 6310 },
  { categoria: "Carnes", total: 7890 },
  { categoria: "Bebidas", total: 5240 },
  { categoria: "Despensa", total: 4680 },
  { categoria: "Limpieza", total: 3120 },
]

export const productosMasVendidos = [
  { nombre: "Leche Entera 1L", unidades: 1240, ingresos: 1364 },
  { nombre: "Pan de Molde", unidades: 980, ingresos: 2058 },
  { nombre: "Agua Mineral 1.5L", unidades: 1860, ingresos: 1581 },
  { nombre: "Pechuga de Pollo", unidades: 420, ingresos: 2604 },
  { nombre: "Arroz 1kg", unidades: 760, ingresos: 1292 },
]

export const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(valor)

export const productosBajoStock = productos.filter((p) => p.stock <= p.stockMinimo)
