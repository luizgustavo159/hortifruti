(() => {
  const formatCurrency = (value) =>
    Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const buildCsv = (rows, delimiter = ",") =>
    rows.map((row) => row.map((cell) => `"${cell ?? ""}"`).join(delimiter)).join("\n");

  const downloadCsv = ({ filename, rows, delimiter = "," }) => {
    if (!rows?.length) {
      return;
    }
    const csv = buildCsv(rows, delimiter);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  window.sharedFormat = {
    formatCurrency,
    buildCsv,
    downloadCsv,
  };
})();
