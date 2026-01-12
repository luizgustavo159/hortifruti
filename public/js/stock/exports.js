(() => {
  const exportTable = ({ type, headers, rows }) => {
    if (type === "pdf") {
      const htmlRows = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
        .join("");
      const exportWindow = window.open("", "_blank");
      if (!exportWindow) {
        window.alert("Não foi possível abrir a janela de exportação.");
        return;
      }
      exportWindow.document.write(`
        <html>
          <head>
            <title>Relatório de estoque</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
              th { background: #f5f5f5; text-align: left; }
            </style>
          </head>
          <body>
            <h3>Relatório de estoque</h3>
            <table>
              <thead>
                <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
              </thead>
              <tbody>${htmlRows}</tbody>
            </table>
          </body>
        </html>
      `);
      exportWindow.document.close();
      exportWindow.focus();
      exportWindow.print();
      return;
    }

    const csvContent = [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "estoque.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  window.stockExports = {
    exportTable,
  };
})();
