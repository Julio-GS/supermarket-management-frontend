# Integración frontend de inventario y stock

Esta guía explica cómo integrar en el frontend los cambios de gestión de stock: productos con inventario, consulta de stock actual, ajustes manuales y descuento automático al crear ventas.

## Resumen rápido

1. Al crear o editar un producto, usar `maneja_stock` para indicar si controla inventario.
2. Mostrar `stock_actual` en respuestas de productos.
3. Usar `GET /stock/:product_id` para consultar stock puntual.
4. Usar `POST /stock/adjust` para ajustes manuales positivos o negativos.
5. Al crear ventas, no se envía información extra de stock: el backend descuenta automáticamente si el producto tiene `maneja_stock=true`.

## Reglas funcionales

| Tema | Regla |
| --- | --- |
| Producto con stock | Un producto controla inventario cuando `maneja_stock=true`. |
| Producto sin stock | Un producto con `maneja_stock=false` no tiene stock operativo; `stock_actual` se devuelve como `null`. |
| Stock inicial | Al crear un producto con `maneja_stock=true`, el stock inicial es `0`. |
| Stock negativo | Está permitido. Una venta puede dejar stock negativo. |
| Venta | La venta no debe bloquearse por stock insuficiente. |
| Falla técnica al descontar stock | La venta se conserva; el backend registra el problema en logs. |
| Ajustes manuales | Se permiten cantidades positivas y negativas. La cantidad debe ser un entero. |

## Autenticación

Los endpoints nuevos usan el mismo esquema protegido que el resto de la API:

```http
Authorization: Bearer <token>
```

Base URL local habitual:

```text
http://localhost:3000/api/v1
```

## Productos

### Crear producto con control de stock

```http
POST /products
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "detalle": "Coca Cola 2.25L",
  "costo_neto": "1000.00",
  "costo_final": "2500.50",
  "iva": "21.00",
  "cambio_costo": "2024-01-01",
  "cambio_precio": "2024-01-01",
  "etiqueta": "bebidas",
  "facturable": true,
  "maneja_stock": true,
  "codigos": ["779000000001"]
}
```

Respuesta relevante:

```json
{
  "id": "product-uuid",
  "detalle": "Coca Cola 2.25L",
  "maneja_stock": true,
  "stock_actual": 0
}
```

### Crear producto sin control de stock

```json
{
  "detalle": "Servicio de envío",
  "costo_neto": "1000.00",
  "costo_final": "1000.00",
  "iva": "21.00",
  "cambio_costo": "2024-01-01",
  "cambio_precio": "2024-01-01",
  "etiqueta": "servicios",
  "facturable": true,
  "maneja_stock": false,
  "codigos": ["SERV-ENVIO"]
}
```

Respuesta relevante:

```json
{
  "id": "product-uuid",
  "maneja_stock": false,
  "stock_actual": null
}
```

### Listado y detalle de productos

Los endpoints existentes ahora incluyen `stock_actual`:

```http
GET /products
GET /products/:id
```

Interpretación frontend:

| Valor | Significado | UI sugerida |
| --- | --- | --- |
| `number` | Producto con stock controlado. Puede ser negativo. | Mostrar cantidad. Si es negativo, resaltarlo como alerta. |
| `0` | Producto controlado sin unidades disponibles. | Mostrar `0`. No bloquear venta por esto. |
| `null` | Producto sin control de stock. | Mostrar `No controla stock` o esconder indicador. |

## Consulta de stock

Usar este endpoint cuando se necesita refrescar el stock de un producto puntual sin recargar todo el producto.

```http
GET /stock/:product_id
Authorization: Bearer <token>
```

Producto con stock:

```json
{
  "stock_actual": 12
}
```

Producto sin stock:

```json
{
  "stock_actual": null
}
```

Producto inexistente:

```http
404 Not Found
```

## Ajustes manuales de stock

Endpoint para entrada, salida o corrección manual de inventario.

```http
POST /stock/adjust
Content-Type: application/json
Authorization: Bearer <token>
```

### Entrada de stock

```json
{
  "product_id": "product-uuid",
  "quantity": 10,
  "reason": "Ingreso manual de mercadería"
}
```

### Salida o corrección negativa

```json
{
  "product_id": "product-uuid",
  "quantity": -3,
  "reason": "Corrección por merma"
}
```

Respuesta:

```json
{
  "id": "movement-uuid",
  "product_id": "product-uuid",
  "quantity": -3,
  "type": "adjustment",
  "reference_id": null,
  "previous_stock": 10,
  "new_stock": 7,
  "reason": "Corrección por merma",
  "created_at": "2026-07-17T00:00:00.000Z"
}
```

Validaciones importantes:

| Caso | Resultado esperado |
| --- | --- |
| `quantity` decimal | Error de validación. Debe ser entero. |
| Producto inexistente | `404`. |
| Producto con `maneja_stock=false` | `400`. No se puede ajustar stock. |
| Ajuste que deja stock negativo | Permitido. |

## Ventas con descuento automático de stock

El frontend no debe enviar campos extra de inventario al crear una venta. El backend descuenta stock automáticamente para cada item de catálogo cuyo producto tenga `maneja_stock=true`.

```http
POST /sales
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "items": [
    {
      "product_id": "product-uuid",
      "quantity": 2
    }
  ],
  "payment_methods": [
    {
      "method": "cash",
      "amount": "5001.00"
    }
  ],
  "invoice_requested": false
}
```

Respuesta de venta: igual al flujo existente. El descuento de stock no cambia el shape de la venta.

Después de la venta, refrescar stock si la pantalla necesita mostrar la cantidad actualizada:

```http
GET /stock/:product_id
```

### Casos especiales en ventas

| Caso | Comportamiento |
| --- | --- |
| Producto con `maneja_stock=true` | Se descuenta `quantity`. |
| Producto con `maneja_stock=false` | No se descuenta nada. |
| Item ad-hoc sin `product_id` | No se descuenta stock. |
| Mismo producto repetido en una venta | El backend agrupa cantidades y descuenta el total. |
| Stock insuficiente | La venta se crea igual y el stock puede quedar negativo. |
| Falla técnica al descontar stock | La venta se crea igual; el backend registra el error en logs. |

## Recomendaciones de UI

### Producto

- Agregar switch o checkbox: `Controla stock` → envía `maneja_stock`.
- Si `maneja_stock=true`, mostrar `stock_actual`.
- Si `maneja_stock=false`, no mostrar cantidad o mostrar `No controla stock`.

### Listado de productos

- Mostrar stock sólo cuando `stock_actual !== null`.
- Resaltar valores negativos, pero no bloquear acciones de venta.
- Si la vista usa cache local, invalidar/refrescar después de un ajuste manual o venta.

### Ajuste de stock

Formulario mínimo:

| Campo | Tipo | Reglas |
| --- | --- | --- |
| Producto | UUID seleccionado | Debe ser producto con `maneja_stock=true`. |
| Cantidad | Entero | Positivo para ingreso, negativo para salida/corrección. |
| Motivo | Texto opcional | Máximo 500 caracteres. |

UX sugerida:

- Mostrar stock anterior antes de ajustar.
- Mostrar stock nuevo usando la respuesta `new_stock`.
- Pedir confirmación cuando `quantity` sea negativo o deje stock negativo.

### Punto de venta

- No impedir vender por stock `0` o negativo.
- Si se muestra stock durante la venta, tratarlo como información, no como bloqueo.
- Después de confirmar la venta, refrescar stock de los productos vendidos si siguen visibles en pantalla.

## Flujo frontend recomendado

### Alta de producto con stock

1. Usuario crea producto con `maneja_stock=true`.
2. Backend responde `stock_actual: 0`.
3. Frontend muestra el producto y ofrece ajustar stock inicial.
4. Usuario hace `POST /stock/adjust` con cantidad positiva.
5. Frontend actualiza el stock usando `new_stock` de la respuesta o `GET /stock/:id`.

### Venta de producto con stock

1. Frontend crea venta normalmente con `POST /sales`.
2. Backend crea la venta y descuenta stock en segundo paso interno.
3. Frontend recibe la venta creada.
4. Frontend refresca stock sólo si la pantalla lo necesita.

### Corrección de inventario

1. Usuario selecciona producto con stock.
2. Frontend consulta `GET /stock/:id`.
3. Usuario ingresa ajuste positivo o negativo.
4. Frontend ejecuta `POST /stock/adjust`.
5. Frontend muestra `previous_stock`, `quantity` y `new_stock`.

## Tipos sugeridos para TypeScript

```ts
export type ProductResponse = {
  id: string;
  detalle: string;
  costo_neto: string | null;
  costo_final: string | null;
  iva: string | null;
  cambio_costo: string;
  cambio_precio: string;
  etiqueta: string;
  facturable: boolean;
  maneja_stock: boolean;
  codigos: string[];
  pricing_mode: string;
  is_protected: boolean;
  stock_actual: number | null;
  created_at: string;
  updated_at: string;
};

export type StockResponse = {
  stock_actual: number | null;
};

export type AdjustStockRequest = {
  product_id: string;
  quantity: number;
  reason?: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  quantity: number;
  type: "sale" | "adjustment" | "initialization";
  reference_id: string | null;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  created_at: string;
};
```

## Checklist de integración

- [ ] El formulario de producto envía `maneja_stock`.
- [ ] El listado/detalle de producto muestra `stock_actual` correctamente.
- [ ] `stock_actual: null` no se trata como `0`.
- [ ] El frontend permite vender aunque el stock sea `0` o negativo.
- [ ] El flujo de ajuste manual permite cantidades negativas.
- [ ] Después de venta o ajuste, se refresca el stock visible.
- [ ] Los errores de ajuste de stock se muestran sólo en ajustes manuales; las ventas no agregan lógica de bloqueo por stock.

## Pruebas manuales con Bruno

La colección Bruno incluye un flujo nuevo en:

```text
bruno/inventory/
```

Orden recomendado:

1. `auth/Login.bru`
2. `inventory/01 Create Stock Product.bru`
3. `inventory/02 Get Stock.bru`
4. `inventory/03 Adjust Stock In.bru`
5. `inventory/04 Adjust Stock Out.bru`
6. `inventory/05 Create Sale With Stock Deduction.bru`
7. `inventory/06 Get Stock After Sale.bru`
8. `inventory/07 Create Non-Stock Product.bru`
9. `inventory/08 Adjust Non-Stock Product Should Fail.bru`
