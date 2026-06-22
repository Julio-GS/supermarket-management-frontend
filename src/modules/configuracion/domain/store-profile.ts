export interface StoreProfile {
  name: string
  taxId: string
  phone: string
  address: string
}

export const defaultStoreProfile: StoreProfile = {
  name: "SuperGestión Central",
  taxId: "B-12345678",
  phone: "+34 912 345 678",
  address: "Calle Mayor 45, 28013 Madrid",
}
