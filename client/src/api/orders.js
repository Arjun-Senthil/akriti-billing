import axios from 'axios'

export const getOrders = async (params = {}) => {
  const res = await axios.get('/api/orders', { params })
  return res.data.data
}

export const getOrderById = async (id) => {
  const res = await axios.get(`/api/orders/${id}`)
  return res.data.data
}

export const createOrder = async (payload) => {
  const res = await axios.post('/api/orders', payload)
  return res.data.data
}

export const updateOrder = async (id, payload) => {
  const res = await axios.put(`/api/orders/${id}`, payload)
  return res.data.data
}

export const deleteOrder = async (id) => {
  const res = await axios.delete(`/api/orders/${id}`)
  return res.data
}
