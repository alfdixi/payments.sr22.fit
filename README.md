
# SR22 Stripe Frontend (React + Vite)

Frontend sencillo para cobrar servicios con Stripe usando el backend `sr22-stripe-gateway`.

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` si es necesario:

```env
VITE_API_BASE_URL=http://localhost:4242
```

## Correr en desarrollo

```bash
npm run dev
```

Vite te mostrará la URL (por defecto `http://localhost:5173`).

Asegúrate de tener **también corriendo** el backend `sr22-stripe-gateway`:

```bash
# en la carpeta del backend
npm run dev
```

## Cómo funciona

1. El usuario selecciona un servicio (membresía, clase, etc.).
2. El frontend hace `POST` a:

```text
POST {VITE_API_BASE_URL}/create-checkout-session
```

con un body como:

```json
{
  "successUrl": "https://tu-front.com?status=success",
  "cancelUrl": "https://tu-front.com?status=cancel",
  "lineItems": [
    {
      "price_data": {
        "currency": "mxn",
        "product_data": {
          "name": "Membresía mensual SR22"
        },
        "unit_amount": 20000
      },
      "quantity": 1
    }
  ]
}
```

3. El backend crea la sesión de Stripe y responde con:

```json
{
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

4. El frontend redirige al usuario a `data.url` para pagar en Stripe.
5. Stripe manda el webhook al backend (`/webhookpay`), y éste a su vez lo puede reenviar a `https://api.sr22.fit/webhookpay`.

## Producción

En producción, lo ideal es:

- Montar este frontend en `https://sr22.fit` (por ejemplo).
- Montar el backend en `https://api.sr22.fit`.
- Configurar CORS en el backend para permitir el origen del frontend.
- Configurar el webhook de Stripe a `https://api.sr22.fit/webhookpay`.
