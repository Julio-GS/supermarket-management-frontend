# Resumen de integración frontend — módulo sales

## Base

- **Base URL local:** `http://localhost:3000/api/v1`
- **Todas las rutas de sales requieren:**
  - `Authorization: Bearer <access_token>`

## Endpoints

1. **Crear venta**
   `POST /sales`
2. **Listar ventas**
   `GET /sales`
3. **Obtener detalle de venta**
   `GET /sales/:id`

---

## Crear venta

### Request mínimo

```json
{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2
    }
  ],
  "payment_methods": ["cash"]
}
```

### Campos

#### `items`
Array obligatorio, mínimo 1.

Cada item:
```json
{
  "product_id": "uuid",
  "quantity": 2
}
```

#### `payment_methods`
Array obligatorio, mínimo 1.

Valores permitidos:
- `cash`
- `transfer`
- `card`
- `qr`

Ejemplo:
```json
"payment_methods": ["cash", "card"]
```

#### `invoice_requested`
Opcional.

```json
"invoice_requested": true
```
- `false` o ausente => venta no fiscal
- `true` => intenta emitir factura electrónica ARCA

#### `split_ticket_groups`
Opcional.  
Se usa solo si quieren dividir visualmente la venta en 2 tickets.

---

## Cómo funciona split ticket

### Idea funcional
- Sigue siendo 1 sola venta
- Sigue habiendo 1 solo `sale_id`
- Sigue habiendo 1 solo conjunto de pagos
- Si hay factura ARCA, sigue siendo 1 sola factura
- El split es solo operativo/visual

### Regla principal
`split_ticket_groups` debe tener exactamente 2 grupos.

Ejemplo:
```json
{
  "items": [
    {
      "product_id": "uuid-product-1",
      "quantity": 2
    }
  ],
  "payment_methods": ["cash", "card"],
  "split_ticket_groups": [
    {
      "label": "A",
      "items": [
        {
          "product_id": "uuid-product-1",
          "quantity": 1
        }
      ]
    },
    {
      "label": "B",
      "items": [
        {
          "product_id": "uuid-product-1",
          "quantity": 1
        }
      ]
    }
  ]
}
```

### Invariantes que frontend TIENE que respetar
- Deben venir 2 grupos exactos
- Los labels deben ser distintos
  - Por ejemplo: `A` y `B`
- La suma de cantidades asignadas entre ambos grupos debe coincidir con la cantidad vendida
- Se puede dividir una misma línea por cantidad
  - Ej: vendés 2 unidades y mandás 1 al grupo `A` + 1 al grupo `B`

### Qué NO hacer
- No mandar 1 grupo solo
- No mandar 3 grupos
- No repetir label
- No dejar cantidades sin asignar
- No sobreasignar cantidades

---

## Respuesta de venta

### Shape general
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "total": "7501.50",
  "payment_methods": ["cash", "card"],
  "split_ticket_groups": [
    {
      "label": "A",
      "items": [
        {
          "product_id": "uuid",
          "quantity": 1,
          "unit_price": "3750.75",
          "subtotal": "3750.75"
        }
      ]
    },
    {
      "label": "B",
      "items": [
        {
          "product_id": "uuid",
          "quantity": 1,
          "unit_price": "3750.75",
          "subtotal": "3750.75"
        }
      ]
    }
  ],
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "quantity": 2,
      "unit_price": "3750.75",
      "subtotal": "7501.50"
    }
  ],
  "invoice_status": "none",
  "cae": null,
  "cae_vto": null,
  "cbte_nro": null,
  "cbte_tipo": null,
  "pto_vta": null,
  "invoice_requested_at": null,
  "created_at": "2026-07-01T12:00:00.000Z",
  "updated_at": "2026-07-01T12:00:00.000Z"
}
```

### Campos importantes para frontend

#### `total`
- string decimal
- NO número
- Ejemplo: `"7501.50"`

#### `payment_methods`
- Siempre array
- Ejemplo:
```json
["cash"]
```

#### `split_ticket_groups`
- Puede venir `null`
- Si no hubo split, esperen `null`
- Si hubo split, esperen array de 2 grupos

#### `invoice_status`
Valores relevantes:
- `none`
- `issued`
- `failed`

#### Campos ARCA
Pueden venir `null` si la venta no fue facturada:
- `cae`
- `cae_vto`
- `cbte_nro`
- `cbte_tipo`
- `pto_vta`
- `invoice_requested_at`

---

## Venta simple vs split vs fiscal

### Venta simple
```json
{
  "items": [{ "product_id": "uuid", "quantity": 2 }],
  "payment_methods": ["cash"]
}
```

### Venta con split ticket
```json
{
  "items": [{ "product_id": "uuid", "quantity": 2 }],
  "payment_methods": ["cash", "card"],
  "split_ticket_groups": [
    {
      "label": "A",
      "items": [{ "product_id": "uuid", "quantity": 1 }]
    },
    {
      "label": "B",
      "items": [{ "product_id": "uuid", "quantity": 1 }]
    }
  ]
}
```

### Venta con factura ARCA
```json
{
  "items": [{ "product_id": "uuid", "quantity": 1 }],
  "payment_methods": ["cash"],
  "invoice_requested": true
}
```

---

## Listar ventas

`GET /sales`

Puede devolver:

### Modo legacy
Un array plano:
```json
[
  {
    "id": "uuid",
    "total": "100.00"
  }
]
```

### Modo paginado
Si mandan query params como `page`, `limit` o `sort`, devuelve:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true
  }
}
```

### Recomendación frontend
NO asuman una sola shape para listados.  
Si usan paginación, modelen el wrapper `{ data, meta }`.

---

## Obtener detalle

`GET /sales/:id`

Devuelve la venta completa, con:
- `payment_methods`
- `split_ticket_groups`
- `items`
- Campos de factura

Este endpoint es el correcto para reconstruir una venta split y mostrar cómo quedó dividida.

---

## Errores que frontend debería manejar

### 400 Bad Request
Casos típicos:
- Faltan `payment_methods`
- `items` vacío
- `split_ticket_groups` con cantidad incorrecta de grupos
- Labels duplicados
- Cantidades mal distribuidas
- UUID inválido

### 401 Unauthorized
- Falta token
- Token inválido

### 404 Not Found
- Producto inexistente
- Venta inexistente o fuera del usuario

### 500 Internal Server Error
- Error interno
- Falla en persistencia
- Posible falla de integración fiscal

---

## Recomendaciones concretas para UI

### Checkout normal
- Siempre pedir al menos un método de pago
- Mandar `payment_methods` como array

### Split ticket UI
- Tratarlo como feature opcional
- Cuando se activa:
  - Mostrar exactamente 2 grupos
  - Validar en frontend que las cantidades cierren
- Si no se activa:
  - No mandar `split_ticket_groups`

### Factura ARCA
- `invoice_requested` debería ser un toggle claro
- Si la respuesta vuelve con `invoice_status = "issued"`, mostrar datos fiscales
- Si vuelve `none`, tratarla como venta no fiscal

### Render del detalle
- Si `split_ticket_groups === null`, mostrar venta normal
- Si viene array, mostrar los 2 tickets armados además del resumen total

---

## Resumen ejecutivo para que no se equivoquen

1. `POST /sales` siempre necesita `items` + `payment_methods`
2. `split_ticket_groups` es opcional
3. Si hay split:
   - Son exactamente 2 grupos
   - No crea otra venta
   - No divide pago
   - No divide factura
4. `total` y montos vienen como strings decimales
5. `split_ticket_groups` puede ser `null`
6. `GET /sales` puede ser array o paginado según query params
7. `GET /sales/:id` es el endpoint clave para reconstruir la venta completa