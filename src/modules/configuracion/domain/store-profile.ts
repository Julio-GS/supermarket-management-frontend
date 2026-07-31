import { merchantFiscalIdentity } from "@/shared/config/merchant-fiscal-identity"

export interface StoreProfile {
  name: string
  taxId: string
  phone: string
  address: string
}

export const defaultStoreProfile: StoreProfile = {
  name: merchantFiscalIdentity.tradeName,
  taxId: merchantFiscalIdentity.cuit,
  phone: "+54 11 0000 0000",
  address: merchantFiscalIdentity.taxOfficeAddress,
}
