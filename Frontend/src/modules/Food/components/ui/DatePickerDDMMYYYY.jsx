import { useState, useEffect, useRef } from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover"
import { Calendar } from "@food/components/ui/calendar"
import { cn } from "@food/utils/utils"

export const parseLocalYMDDate = (value) => {
  if (!value || typeof value !== "string") return undefined
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

export const formatDateToLocalYMD = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const formatYMDToDDMMYYYY = (ymd) => {
  if (!ymd || typeof ymd !== "string") return ""
  const parts = ymd.split("-")
  if (parts.length !== 3) return ""
  const [year, month, day] = parts
  if (!year || !month || !day) return ""
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
}

export const parseDDMMYYYYToYMD = (str) => {
  if (!str || typeof str !== "string") return ""
  const parts = str.split("/").map((p) => p.trim())
  if (parts.length !== 3) return ""
  const [day, month, year] = parts
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return ""
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return ""
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return ""
  const testDate = new Date(y, m - 1, d)
  if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) return ""
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export default function DatePickerDDMMYYYY({
  value = "",
  onChange,
  min,
  max,
  placeholder = "DD/MM/YYYY",
  className,
  disabled = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(() => formatYMDToDDMMYYYY(value))
  const lastPropValue = useRef(value)

  useEffect(() => {
    if (value !== lastPropValue.current) {
      lastPropValue.current = value
      setInputValue(formatYMDToDDMMYYYY(value))
    }
  }, [value])

  const handleInputChange = (e) => {
    const raw = e.target.value
    // Allow digits and slashes
    let cleaned = raw.replace(/[^\d/]/g, "")

    // Auto-insert slash after day and month if user is just typing numbers
    if (!raw.includes("/") && cleaned.length > 2) {
      if (cleaned.length <= 4) {
        cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`
      } else {
        cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`
      }
    }

    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10)
    setInputValue(cleaned)

    if (cleaned.length === 10) {
      const ymd = parseDDMMYYYYToYMD(cleaned)
      if (ymd) {
        lastPropValue.current = ymd
        onChange?.(ymd)
      }
    } else if (cleaned === "") {
      lastPropValue.current = ""
      onChange?.("")
    }
  }

  const handleBlur = () => {
    if (inputValue) {
      const ymd = parseDDMMYYYYToYMD(inputValue)
      if (ymd) {
        lastPropValue.current = ymd
        onChange?.(ymd)
        setInputValue(formatYMDToDDMMYYYY(ymd))
      } else {
        // If invalid text, restore previous valid date or clear
        if (value) {
          setInputValue(formatYMDToDDMMYYYY(value))
        } else {
          setInputValue("")
          onChange?.("")
        }
      }
    } else {
      onChange?.("")
    }
  }

  const selectedDate = parseLocalYMDDate(value)
  const currentYear = new Date().getFullYear()

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <div className="relative w-full">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={10}
          className={cn(
            "w-full rounded-md border border-input bg-white h-10 px-3 pr-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Open calendar"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 focus:outline-none transition-colors"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0 z-50 bg-white shadow-lg border border-gray-200 rounded-md" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          captionLayout="dropdown"
          fromYear={currentYear - 5}
          toYear={currentYear + 15}
          disabled={(date) => {
            const ymd = formatDateToLocalYMD(date)
            if (min && ymd < min) return true
            if (max && ymd > max) return true
            return false
          }}
          onSelect={(date) => {
            if (date) {
              const ymd = formatDateToLocalYMD(date)
              lastPropValue.current = ymd
              setInputValue(formatYMDToDDMMYYYY(ymd))
              onChange?.(ymd)
              setIsOpen(false)
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
