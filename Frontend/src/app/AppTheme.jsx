import { useEffect } from "react"
import { applyAppTheme, DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization"

export default function AppTheme() {
  useEffect(() => {
    let mounted = true
    applyAppTheme(DEFAULT_APP_CUSTOMIZATION)
    loadAppCustomization()
      .then((settings) => {
        if (mounted) applyAppTheme(settings)
      })
      .catch(() => {
        if (mounted) applyAppTheme(DEFAULT_APP_CUSTOMIZATION)
      })

    return () => {
      mounted = false
    }
  }, [])

  return null
}
