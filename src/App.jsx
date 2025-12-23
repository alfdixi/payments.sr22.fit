
import React, { useState, useMemo, useEffect } from 'react'
import InputMask from 'react-input-mask';

const formatCurrency = (amount, currency = 'mxn') =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)

function App() {
  console.log('🔥 App se está renderizando')

  // 🔹 Estado de productos (antes SERVICES hardcodeado)
  const [services, setServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')


  // 🔹 Datos del cliente
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [externalId, setExternalId] = useState('') // id externo
  const [fetchingName, setFetchingName] = useState(false);
  const [foundCustomerId, setFoundCustomerId] = useState('');

  // 🔹 UI
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')

  // 🔹 Estado de carga de productos
  const [loadingServices, setLoadingServices] = useState(true)
  const [servicesError, setServicesError] = useState('')

  // Gateway (donde está /create-checkout-session)
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4242'

  // Base del API SR22 (auth + products)
  const sr22ApiBase = import.meta.env.VITE_SR22_API_BASE_URL || 'https://api.sr22.fit'

  // La API key para /auth/token
  // ⚠️ En Vite, las vars que quieres en el front deben empezar con VITE_
  const apiKeyForToken =
    import.meta.env.VITE_API_KEY_FOR_TOKEN ||
    import.meta.env.VITE_INTERNAL_WEBHOOK_SECRET || // por si la renombraste
    'sr22-internal-api-key'

  // Servicio seleccionado
  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === String(selectedServiceId)),
    [services, selectedServiceId],
  )

  // 1️⃣ Leer parámetros de la URL (name, email, id, idprod, status)
  useEffect(() => {
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
    const phone = params.get('phone')
    const id = params.get('id')

    if (name) setClientName(name)
    if (phone) setClientPhone(phone)
    if (id) setExternalId(id)
  }, [])

  // 2️⃣ Cargar productos desde api.sr22.fit (auth + products) y aplicar idprod
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoadingServices(true)
        setServicesError('')

        // a) Obtener token
        const authRes = await fetch(`${sr22ApiBase}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKeyForToken }),
        })

        if (!authRes.ok) {
          const errData = await authRes.json().catch(() => ({}))
          throw new Error(errData.error || 'Error al obtener token')
        }

        const { token } = await authRes.json()
        if (!token) {
          throw new Error('El API no devolvió token.')
        }

        // b) Obtener productos
        const productsRes = await fetch(`${sr22ApiBase}/products`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!productsRes.ok) {
          const errData = await productsRes.json().catch(() => ({}))
          throw new Error(errData.error || 'Error al obtener productos')
        }

        const data = await productsRes.json()

        // data esperado: [{ id: "1", name, amount, currency }, ...]
        setServices(data || [])

        // c) Revisar si vino idprod en la URL
        const params = new URLSearchParams(window.location.search)
        const idprod = params.get('idprod')

        if (idprod) {
          const exists = (data || []).some((s) => String(s.id) === String(idprod))
          if (exists) {
            setSelectedServiceId(String(idprod))
          } else if (data && data.length > 0) {
            // Si idprod no existe, seleccionamos el primero
            setSelectedServiceId(String(data[0].id))
          }
        } else if (data && data.length > 0) {
          // Si no hay idprod, seleccionar el primero
          setSelectedServiceId(String(data[0].id))
        }
      } catch (err) {
        console.error('Error cargando servicios desde API:', err)
        setServicesError(err.message || 'No se pudieron cargar los servicios')
      } finally {
        setLoadingServices(false)
      }
    }

    loadServices()
  }, [sr22ApiBase, apiKeyForToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    setLoading(true)

    try {
      if (!selectedService) {
        throw new Error('No hay un servicio seleccionado.')
      }

      const successUrl = `${window.location.origin}?status=success&name=${encodeURIComponent(clientName)}&phone=${encodeURIComponent(clientPhone)}&id=${encodeURIComponent(externalId)}&idprod=${selectedService.id}`
      const cancelUrl = `${window.location.origin}?status=cancel&name=${encodeURIComponent(clientName)}&phone=${encodeURIComponent(clientPhone)}&id=${encodeURIComponent(externalId)}&idprod=${selectedService.id}`

      const body = {
        successUrl,
        cancelUrl,
        lineItems: [
          {
            price_data: {
              currency: selectedService.currency,
              product_data: {
                name: selectedService.name,
                metadata: {
                  service_id: selectedService.id,
                  client_name: clientName,
                  client_phone: clientPhone,
                  external_id: externalId,
                },
              },
              unit_amount: selectedService.amount,
            },
            quantity: 1,
          },
        ],
      }

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

  // 🧩 Estados de carga de servicios
  if (loadingServices) {
    return (
      <div className="container">
        <h1>SR22 – Pago de servicios</h1>
        <p>Cargando servicios...</p>
      </div>
    )
  }

  if (servicesError) {
    return (
      <div className="container">
        <h1>SR22 – Pago de servicios</h1>
        <div className="error-message">❌ {servicesError}</div>
        <footer className="footer">
          <small>
            API pagos (gateway): <code>{apiBaseUrl}</code>
            <br />
            API productos: <code>{sr22ApiBase}</code>
          </small>
        </footer>
      </div>
    )
  }

  return (
    <div className="container">
      <center><img src="https://admin.sr22.fit/includes/img/logo.png" alt="SR22 Logo" width="200" /></center>
      <h1>SR22 – Pago de servicios</h1>
      <p className="subtitle">
        Selecciona el servicio y realiza tu pago de forma segura con Stripe.
      </p>

      {statusMessage && <div className="status-message">{statusMessage}</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="service">Servicio.</label>
          <select
            id="service"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} – {formatCurrency(service.amount, service.currency)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="clientPhone">Teléfono</label>
          <InputMask
            mask="99-9999-9999"
            value={clientPhone}
            onChange={async (e) => {
              const value = e.target.value;
              setClientPhone(value);
              // Extraer solo dígitos
              const digits = value.replace(/\D/g, '');
              if (digits.length === 10) {
                setFetchingName(true);
                try {
                  // 1. Obtener token
                  const authRes = await fetch(`${sr22ApiBase}/auth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: apiKeyForToken }),
                  });
                  if (!authRes.ok) throw new Error('Error autenticando');
                  const { token } = await authRes.json();
                  if (!token) throw new Error('No se obtuvo token');
                  // 2. Buscar cliente por teléfono
                  const phoneRes = await fetch(`${sr22ApiBase}/costumer/find-by-phone`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ phone: value })
                  });
                  if (phoneRes.ok) {
                    const data = await phoneRes.json();
                    if (data.id) {
                      setFoundCustomerId(String(data.id));
                      setExternalId(String(data.id)); // Asignar externalId para habilitar el botón
                    }
                    if (data.name) setClientName(data.name);
                    // Si no hay servicio seleccionado, usar el id encontrado
                    if (!selectedServiceId && data.id) {
                      setSelectedServiceId(String(data.id));
                    }
                  } else {
                    setClientName(''); // Limpiar si no se encuentra
                    setFoundCustomerId('');
                    setExternalId('');
                  }
                } catch (err) {
                  setClientName('');
                  setFoundCustomerId('');
                  setExternalId('');
                } finally {
                  setFetchingName(false);
                }
              } else {
                setClientName('');
                setFoundCustomerId('');
                setExternalId('');
              }
            }}
          >
            {(inputProps) => (
              <input
                {...inputProps}
                id="clientPhone"
                type="text"
                placeholder="00-0000-0000"
                autoComplete="tel"
                value={clientPhone}
              />
            )}
          </InputMask>
          {fetchingName && <div style={{fontSize:'0.9em',color:'#888'}}>Buscando nombre…</div>}
        </div>

        <div className="form-group">
          <label htmlFor="clientName">Nombre del cliente</label>
          <input
            id="clientName"
            type="text"
            placeholder="Nombre"
            value={clientName}
            readOnly
          />
        </div>

        

        {selectedService && (
          <div className="summary">
            <span>Total a pagar:</span>
            <strong>
              {formatCurrency(selectedService.amount, selectedService.currency)}
            </strong>
          </div>
        )}

        <button
          className="pay-button"
          type="submit"
          disabled={loading || !selectedService || !(Number(externalId) > 0)}
        >
          {loading ? 'Redirigiendo a Stripe…' : 'Pagar con Stripe'}
        </button>

        <p className="helper-text">
          Serás redirigido a la página segura de Stripe para completar tu pago.
        </p>
      </form>

      <footer className="footer">
        <small>
          https://sr22.fit
        </small>
      </footer>
    </div>
  )
}

export default App
