import axios from 'axios'

export const addPayment = async (orderId, payload) => {
  const res = await axios.post(`/api/orders/${orderId}/payments`, payload)
  return res.data.data
}
