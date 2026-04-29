import axios from 'axios'

export const getSettings = async () => {
  const res = await axios.get('/api/settings')
  return res.data.data  // { gst_rate: '5.00', shop_name: 'Akriti Tales', ... }
}

export const updateSetting = async (key, value) => {
  const res = await axios.put(`/api/settings/${key}`, { value })
  return res.data.data
}
