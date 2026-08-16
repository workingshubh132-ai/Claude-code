import { useEffect, useMemo, useState } from 'react'
import {
  listPayments,
  createPayment,
  setPaymentStatus,
  deletePayment,
  subscribeToPayments,
} from '../lib/api'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function isOverdue(payment) {
  if (payment.status === 'received' || !payment.due_date) return false
  return new Date(payment.due_date) < new Date()
}

export default function PaymentList({ assetId, userId }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('incoming')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listPayments(assetId)
      .then((data) => !cancelled && setPayments(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    const unsubscribe = subscribeToPayments(assetId, () => {
      listPayments(assetId).then((data) => !cancelled && setPayments(data))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [assetId])

  // Incoming and outgoing are kept apart so they never quietly net out.
  const totals = useMemo(() => {
    const sum = { receivedIn: 0, pendingIn: 0, paidOut: 0, pendingOut: 0 }
    for (const p of payments) {
      const value = Number(p.amount) || 0
      if (p.direction === 'incoming') {
        if (p.status === 'received') sum.receivedIn += value
        else sum.pendingIn += value
      } else if (p.status === 'received') sum.paidOut += value
      else sum.pendingOut += value
    }
    return sum
  }, [payments])

  async function handleAdd(e) {
    e.preventDefault()
    const value = Number.parseFloat(amount)
    if (!description.trim() || !Number.isFinite(value) || value < 0 || busy) return

    setError(null)
    setBusy(true)
    try {
      const payment = await createPayment({
        assetId,
        description: description.trim(),
        amount: value,
        direction,
        dueDate,
        recordedBy: userId,
      })
      setPayments((prev) => [...prev, payment])
      setDescription('')
      setAmount('')
      setDueDate('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(payment) {
    setError(null)
    try {
      const next = payment.status === 'received' ? 'pending' : 'received'
      const updated = await setPaymentStatus(payment.id, next)
      setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(payment) {
    if (!confirm(`Remove "${payment.description}" from the hisab?`)) return
    setError(null)
    try {
      await deletePayment(payment.id)
      setPayments((prev) => prev.filter((p) => p.id !== payment.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="payment-list">
      <div className="hisab-summary">
        <div className="hisab-total">
          <span className="muted">Received</span>
          <strong className="amount-received">{money.format(totals.receivedIn)}</strong>
        </div>
        <div className="hisab-total">
          <span className="muted">Pending</span>
          <strong className="amount-pending">{money.format(totals.pendingIn)}</strong>
        </div>
        {(totals.paidOut > 0 || totals.pendingOut > 0) && (
          <>
            <div className="hisab-total">
              <span className="muted">Paid out</span>
              <strong>{money.format(totals.paidOut)}</strong>
            </div>
            <div className="hisab-total">
              <span className="muted">To pay</span>
              <strong className="amount-pending">{money.format(totals.pendingOut)}</strong>
            </div>
          </>
        )}
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder="What for (e.g. Booking amount)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="incoming">To receive</option>
          <option value="outgoing">To pay</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="Due date"
        />
        <button className="brass-button small" type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add entry'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="muted">Nothing recorded yet.</p>
      ) : (
        payments.map((payment) => (
          <div key={payment.id} className={`payment-row status-${payment.status}`}>
            <div className="payment-info">
              <div className="document-name-row">
                <strong>{payment.description}</strong>
                <span className={`status-badge status-badge-${payment.status}`}>
                  {payment.status === 'received'
                    ? payment.direction === 'incoming'
                      ? 'Received'
                      : 'Paid'
                    : 'Pending'}
                </span>
              </div>
              <div className="document-meta">
                <span>{payment.direction === 'incoming' ? 'To receive' : 'To pay'}</span>
                {payment.due_date && (
                  <span className={isOverdue(payment) ? 'expiry-warning' : ''}>
                    Due {new Date(payment.due_date).toLocaleDateString()}
                    {isOverdue(payment) ? ' — overdue' : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="payment-amount">
              <strong
                className={payment.status === 'received' ? 'amount-received' : 'amount-pending'}
              >
                {money.format(Number(payment.amount) || 0)}
              </strong>
            </div>

            <div className="document-actions">
              <button className="brass-button small" onClick={() => handleToggle(payment)}>
                {payment.status === 'received' ? 'Mark pending' : 'Mark received'}
              </button>
              <button className="link-button small" onClick={() => handleDelete(payment)}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
