type LocalStorageValue<T> = { value: T; expires: number | null }

export function setLocalStorage(
  key: string,
  value: unknown,
  expires: number | null = 1000 * 60 * 60 * 3
) {
  const result: LocalStorageValue<typeof value> = {
    value,
    expires: expires === null ? null : Date.now() + expires
  }
  localStorage.setItem(key, JSON.stringify(result))
  return true
}

export function getLocalStorage(key: string) {
  const currentTime = Date.now()

  const value = localStorage.getItem(key)
  if (!value) {
    return false
  }
  const result: LocalStorageValue<unknown> = JSON.parse(value)

  // 如果过期了就删掉
  if (result.expires !== null && result.expires < currentTime) {
    localStorage.removeItem(key)
    return false
  }
  return result.value
}

export function removeLocalStorage(key: string) {
  if (!getLocalStorage(key)) {
    return false
  }
  localStorage.removeItem(key)
  return true
}
