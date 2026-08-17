interface OfflineBannerProps {
  onRetryConnectivity: () => void
}

export function OfflineBanner({ onRetryConnectivity }: OfflineBannerProps) {
  return (
    <div
      role="status"
      aria-label="Modo offline activo"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#f59e0b",
        color: "#000",
        textAlign: "center",
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontWeight: 500,
      }}
    >
      Sin conexion - trabajando con datos locales. Los cambios se sincronizaran al reconectarte.
      <div style={{ marginTop: "4px" }}>
        <button
          onClick={onRetryConnectivity}
          style={{
            background: "#fff",
            color: "#000",
            border: "1px solid #d97706",
            borderRadius: "4px",
            padding: "2px 12px",
            fontSize: "0.7rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar conexión
        </button>
      </div>
    </div>
  )
}
