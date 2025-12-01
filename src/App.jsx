
import React, { useState, useMemo } from 'react'

const FORWARD_WEBHOOK_URL_AUTH = process.env.FORWARD_WEBHOOK_URL_AUTH || 'https://api.sr22.fit/auth/token';
const GET_PRODUCTS_URL = process.env.GET_PRODUCTS_URL || 'https://api.sr22.fit/products';
// Obtener un token de autenticación con FORWARD_WEBHOOK_URL_AUTH
let authToken = null; 
try {
  const authResponse = await axios.post(FORWARD_WEBHOOK_URL_AUTH, {
    apiKey: process.env.INTERNAL_WEBHOOK_SECRET || 'sr22-internal-api-key',
  });
  authToken = authResponse.data.token;
  console.log('🔐 Token de autenticación obtenido');
} catch (authErr) {
  console.error('❌ Error obteniendo token de autenticación:', authErr.message);
}
// const SERVICES =  servicio GET  de process.env.GET_PRODUCTS_URL || 'https://api.sr22.fit/products' ;

// agregar token como barear token en headers si existe
const headers = {
  'x-sr22-signature': process.env.X_SR22_SIGNATURE || 'sr22-dev-webhook',
};
if (authToken) {
  headers['Authorization'] = `Bearer ${authToken}`;
}
const SERVICES = await axios.post(GET_PRODUCTS_URL, payload, {
  headers,
});

console.log('✅ Respuesta de tu API SERVICES:', SERVICES);

const formatCurrency = (amount, currency = 'mxn') =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)

function App() {
  const [selectedServiceId, setSelectedServiceId] = useState(SERVICES[0].id)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [externalId, setExternalId] = useState('') // 👈 NUEVO
  const [serviceLocked, setServiceLocked] = useState(false) // 👈 NUEVO
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4242'

  const selectedService = useMemo(
    () => SERVICES.find((s) => s.id === selectedServiceId),
    [selectedServiceId],
  )

React.useEffect(() => {
  const params = new URLSearchParams(window.location.search)

  // Mensajes de estado de pago
  const status = params.get('status')
  if (status === 'success') {
    setStatusMessage('✅ ¡Pago realizado con éxito! Gracias por tu compra.')
  } else if (status === 'cancel') {
    setStatusMessage('⚠️ El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.')
  }

  // Prefill desde query string
  const name = params.get('name')
  const email = params.get('email')
  const id = params.get('id')
  const idprod = params.get('idprod')

  if (name) {
    setClientName(name)
  }
  if (email) {
    setClientEmail(email)
  }
  if (id) {
    setExternalId(id)
  }
  // Si viene idprod y coincide con algún servicio, lo seleccionamos
  if (idprod) {
    const exists = SERVICES.some((s) => s.id === idprod)
    if (exists) {
      setSelectedServiceId(idprod)
      setServiceLocked(true) // 👈 BLOQUEAMOS EL SELECT
    }
  }
}, [])


  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    setLoading(true)

    try {
      const successUrl = `${window.location.origin}?status=success`
      const cancelUrl = `${window.location.origin}?status=cancel`
      console.log("🌐 SUCCESS URL:", successUrl)
      const body = {
        successUrl,
        cancelUrl,
        // En producción es mejor NO mandar amount desde el front y sólo mandar un ID,
        // pero para demo lo hacemos así:
        lineItems: [
          {
            price_data: {
              currency: selectedService.currency,
              product_data: {
                name: selectedService.name,
                metadata: {
                  service_id: selectedService.id,
                  client_name: clientName,
                  client_email: clientEmail,
                  external_id: externalId, // 👈 NUEVO
                },
              },
              unit_amount: selectedService.amount,
            },
            quantity: 1,
          },
        ],
      }

      console.log("📦 PAYLOAD ENVIADO A BACKEND:", body)

      const res = await fetch(`${apiBaseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Error al crear la sesión de pago')
      }

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else if (data.id) {
        // Si en algún momento decides usar Stripe.js, aquí podrías usar redirectToCheckout con sessionId.
        throw new Error('La respuesta no incluyó la URL de Checkout.')
      } else {
        throw new Error('Respuesta inesperada del servidor.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Ocurrió un error al iniciar el pago.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>SR22 – Pago de servicios</h1>
      <p className="subtitle">
        Selecciona el servicio y realiza tu pago de forma segura con Stripe.
      </p>

      {statusMessage && <div className="status-message">{statusMessage}</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="service">Servicio</label>
          <select
            id="service"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            disabled={serviceLocked} // 👈 AQUÍ
          >
            {SERVICES.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} – {formatCurrency(service.amount, service.currency)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="clientName">Nombre del cliente (opcional)</label>
          <input
            id="clientName"
            type="text"
            placeholder="Juan Pérez"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="clientEmail">Correo electrónico (opcional)</label>
          <input
            id="clientEmail"
            type="email"
            placeholder="cliente@correo.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
        </div>

        <div className="summary">
          <span>Total a pagar:</span>
          <strong>{formatCurrency(selectedService.amount, selectedService.currency)}</strong>
        </div>

        <button className="pay-button" type="submit" disabled={loading}>
          {loading ? 'Redirigiendo a Stripe…' : 'Pagar con Stripe'}
        </button>

        <p className="helper-text">
          Serás redirigido a la página segura de Stripe para completar tu pago.
        </p>
      </form>

      <footer className="footer">
        <small>
          API base: <code>{apiBaseUrl}</code>
        </small>
      </footer>
    </div>
  )
}

export default App
