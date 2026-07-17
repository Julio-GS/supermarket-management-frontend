"use client"

import { useCallback, useReducer } from "react"
import type { Product } from "../domain/product"

type CreateField = "name" | "sku" | "price" | "manejaStock" | "costoNeto" | "iva"
type EditField = "name" | "sku" | "price" | "manejaStock"

interface DialogState {
  create: {
    open: boolean
    name: string
    sku: string
    price: string
    manejaStock: boolean
    costoNeto: string
    iva: string
  }
  edit: {
    product: Product | null
    name: string
    sku: string
    price: string
    manejaStock: boolean
    saving: boolean
  }
}

type DialogAction =
  | { type: "CREATE_OPEN" }
  | { type: "CREATE_CLOSE" }
  | { type: "CREATE_RESET" }
  | { type: "CREATE_SET_FIELD"; field: CreateField; value: string }
  | { type: "EDIT_OPEN"; product: Product }
  | { type: "EDIT_CLOSE" }
  | { type: "EDIT_SET_FIELD"; field: EditField; value: string }
  | { type: "EDIT_SET_SAVING"; saving: boolean }

const initialState: DialogState = {
  create: {
    open: false,
    name: "",
    sku: "",
    price: "",
    manejaStock: false,
    costoNeto: "",
    iva: "",
  },
  edit: {
    product: null,
    name: "",
    sku: "",
    price: "",
    manejaStock: false,
    saving: false,
  },
}

function booleanFieldValue(value: string): boolean {
  return value === "true"
}

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "CREATE_OPEN":
      return { ...state, create: { ...state.create, open: true } }
    case "CREATE_CLOSE":
      return { ...state, create: { ...state.create, open: false } }
    case "CREATE_RESET":
      return { ...state, create: initialState.create }
    case "CREATE_SET_FIELD":
      return {
        ...state,
        create: {
          ...state.create,
          [action.field]: action.field === "manejaStock" ? booleanFieldValue(action.value) : action.value,
        },
      }
    case "EDIT_OPEN":
      return {
        ...state,
        edit: {
          product: action.product,
          name: action.product.name,
          sku: action.product.sku,
          price: String(action.product.price),
          manejaStock: action.product.manejaStock,
          saving: false,
        },
      }
    case "EDIT_CLOSE":
      return { ...state, edit: initialState.edit }
    case "EDIT_SET_FIELD":
      return {
        ...state,
        edit: {
          ...state.edit,
          [action.field]: action.field === "manejaStock" ? booleanFieldValue(action.value) : action.value,
        },
      }
    case "EDIT_SET_SAVING":
      return { ...state, edit: { ...state.edit, saving: action.saving } }
    default:
      return state
  }
}

export interface UseProductsTableDialogResult {
  create: DialogState["create"]
  edit: DialogState["edit"]
  openCreate: () => void
  closeCreate: () => void
  resetCreate: () => void
  setCreateField: (field: CreateField, value: string) => void
  openEdit: (product: Product) => void
  closeEdit: () => void
  setEditField: (field: EditField, value: string) => void
  setEditSaving: (saving: boolean) => void
}

export function useProductsTableDialog(): UseProductsTableDialogResult {
  const [state, dispatch] = useReducer(dialogReducer, initialState)

  const openCreate = useCallback(() => dispatch({ type: "CREATE_OPEN" }), [])
  const closeCreate = useCallback(() => dispatch({ type: "CREATE_CLOSE" }), [])
  const resetCreate = useCallback(() => dispatch({ type: "CREATE_RESET" }), [])
  const setCreateField = useCallback(
    (field: CreateField, value: string) => dispatch({ type: "CREATE_SET_FIELD", field, value }),
    []
  )
  const openEdit = useCallback(
    (product: Product) => dispatch({ type: "EDIT_OPEN", product }),
    []
  )
  const closeEdit = useCallback(() => dispatch({ type: "EDIT_CLOSE" }), [])
  const setEditField = useCallback(
    (field: EditField, value: string) => dispatch({ type: "EDIT_SET_FIELD", field, value }),
    []
  )
  const setEditSaving = useCallback(
    (saving: boolean) => dispatch({ type: "EDIT_SET_SAVING", saving }),
    []
  )

  return {
    create: state.create,
    edit: state.edit,
    openCreate,
    closeCreate,
    resetCreate,
    setCreateField,
    openEdit,
    closeEdit,
    setEditField,
    setEditSaving,
  }
}
