(() => {
  const buildReportQuery = ({ start, end } = {}) => {
    const params = new URLSearchParams();
    if (start) {
      params.set("start", start);
    }
    if (end) {
      params.set("end", end);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const renderList = (element, items, emptyMessage) => {
    if (!element) {
      return;
    }
    if (!items.length) {
      element.innerHTML = `<li class="text-muted">${emptyMessage}</li>`;
      return;
    }
    element.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
  };

  const renderTable = (element, items, emptyMessage) => {
    if (!element) {
      return;
    }
    if (!items.length) {
      element.innerHTML = `<tr><td colspan="3" class="text-muted">${emptyMessage}</td></tr>`;
      return;
    }
    element.innerHTML = items
      .map(
        (item) => `
          <tr>
            <td>${item.label}</td>
            <td>${item.items}</td>
            <td>${item.total}</td>
          </tr>
        `
      )
      .join("");
  };

  window.adminReportsUtils = {
    buildReportQuery,
    renderList,
    renderTable,
  };
})();
