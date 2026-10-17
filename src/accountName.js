export function normalizeAccountName(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return ''
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length <= 100 ? name : ''
}

export function accountName(user) {
  const metadata = user?.user_metadata || {}
  return [metadata.full_name, metadata.display_name, metadata.name].map(normalizeAccountName).find(Boolean) || ''
}

export function requiredAccountName(value) {
  const name = normalizeAccountName(value)
  if (!name) throw new Error('Enter the name you want Stratum to use (1–100 characters).')
  return name
}

