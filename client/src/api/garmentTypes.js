import axios from 'axios'

export const getGarmentTypes = async () => {
  const res = await axios.get('/api/garment-types')
  return res.data.data
}
