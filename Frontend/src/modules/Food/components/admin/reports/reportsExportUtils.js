// Export utility functions for reports

export const exportReportsToCSV = (data, headers, filename = "report") => {
  const rows = data.map((item) => {
    return headers.map((header) => {
      let value = item[header.key] || item[header] || ""
      if (typeof value === "string") {
        value = value.replace(/[â‚¹\u20B9]/g, "").trim()
      }
      return typeof value === "object" ? JSON.stringify(value) : value
    })
  })

  const headerRow = headers.map((h) => typeof h === "string" ? h : h.label).join(",")
  const csvContent = [
    headerRow,
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReportsToExcel = (data, headers, filename = "report") => {
  const headerLabels = headers.map((h) => typeof h === "string" ? h : h.label)

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headerLabels.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.map((item) => {
            return `<tr>` + headers.map((header) => {
              const value = item[header.key] || item[header] || ""
              return `<td>${String(value)}</td>`
            }).join("") + `</tr>`
          }).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `

  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReportsToPDF = (data, headers, filename = "report", title = "Report") => {
  const headerRow = headers.map((h) => typeof h === "string" ? h : h.label)

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        h1 { text-align: center; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${headerRow.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.map((item) => {
            const cells = headers.map((header) => {
              const value = item[header.key] || item[header] || ""
              return `<td>${String(value)}</td>`
            })
            return `<tr>${cells.join("")}</tr>`
          }).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `

  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

export const exportReportsToJSON = (data, filename = "report") => {
  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Specific export functions for Transaction Report
export const exportTransactionReportToCSV = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Reference ID", "Type", "Restaurant", "Customer Name", "Billing", "User Paid", "Meal Value", "Settlement Value", "Restaurant Share", "Delivery Share", "Platform Profit", "Status"]
  const rows = transactions.map((transaction, index) => [
    index + 1,
    transaction.referenceId || transaction.orderId || "N/A",
    transaction.transactionTypeLabel || transaction.transactionType || "N/A",
    transaction.restaurant || "N/A",
    transaction.customerName || "N/A",
    transaction.billingMode === "subscription_prepaid" ? "Subscription" : "Direct",
    Number(transaction.customerPaymentAmount || 0).toFixed(2),
    Number(transaction.mealValue || 0).toFixed(2),
    Number(transaction.operationalValue || transaction.orderAmount || 0).toFixed(2),
    Number(transaction.restaurantShare || 0).toFixed(2),
    Number(transaction.deliveryShare || 0).toFixed(2),
    Number(transaction.platformProfit || 0).toFixed(2),
    transaction.status || "N/A",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportTransactionReportToExcel = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Reference ID", "Type", "Restaurant", "Customer Name", "Billing", "User Paid", "Meal Value", "Settlement Value", "Restaurant Share", "Delivery Share", "Platform Profit", "Status"]

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${transactions.map((transaction, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${transaction.referenceId || transaction.orderId || "N/A"}</td>
              <td>${transaction.transactionTypeLabel || transaction.transactionType || "N/A"}</td>
              <td>${transaction.restaurant || "N/A"}</td>
              <td>${transaction.customerName || "N/A"}</td>
              <td>${transaction.billingMode === "subscription_prepaid" ? "Subscription" : "Direct"}</td>
              <td>Rs. ${Number(transaction.customerPaymentAmount || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.mealValue || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.operationalValue || transaction.orderAmount || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.restaurantShare || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.deliveryShare || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.platformProfit || 0).toFixed(2)}</td>
              <td>${transaction.status || "N/A"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `

  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportTransactionReportToPDF = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Reference ID", "Type", "Restaurant", "Customer Name", "Billing", "User Paid", "Meal Value", "Settlement Value", "Restaurant Share", "Delivery Share", "Platform Profit", "Status"]

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        h1 { text-align: center; }
      </style>
    </head>
    <body>
      <h1>Transaction Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${transactions.map((transaction, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${transaction.referenceId || transaction.orderId || "N/A"}</td>
              <td>${transaction.transactionTypeLabel || transaction.transactionType || "N/A"}</td>
              <td>${transaction.restaurant || "N/A"}</td>
              <td>${transaction.customerName || "N/A"}</td>
              <td>${transaction.billingMode === "subscription_prepaid" ? "Subscription" : "Direct"}</td>
              <td>Rs. ${Number(transaction.customerPaymentAmount || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.mealValue || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.operationalValue || transaction.orderAmount || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.restaurantShare || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.deliveryShare || 0).toFixed(2)}</td>
              <td>Rs. ${Number(transaction.platformProfit || 0).toFixed(2)}</td>
              <td>${transaction.status || "N/A"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `

  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

export const exportTransactionReportToJSON = (transactions, filename = "transaction_report") => {
  const jsonContent = JSON.stringify(transactions, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
