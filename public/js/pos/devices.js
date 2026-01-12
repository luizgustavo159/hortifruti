(() => {
  const renderDeviceStatus = (list, devices = []) => {
    if (!list) {
      return;
    }
    list.innerHTML = "";
    if (!devices.length) {
      list.innerHTML = '<div class="list-group-item text-muted">Nenhum dispositivo cadastrado.</div>';
      return;
    }
    devices.forEach((device) => {
      const item = document.createElement("div");
      item.className = "list-group-item d-flex justify-content-between align-items-center";
      const status = device.active ? "Ativo" : "Inativo";
      const badgeClass = device.active ? "text-bg-success" : "text-bg-secondary";
      item.innerHTML = `
        <div>
          <div class="fw-semibold">${device.name}</div>
          <div class="text-muted small">${device.type} • ${device.connection}</div>
        </div>
        <span class="badge ${badgeClass}">${status}</span>
      `;
      list.appendChild(item);
    });
  };

  const loadDevices = async ({ getJson, list } = {}) => {
    if (!getJson) {
      throw new Error("API indisponível.");
    }
    const devices = await getJson("/api/pos/devices");
    renderDeviceStatus(list, devices || []);
    return devices || [];
  };

  window.posDevices = {
    loadDevices,
    renderDeviceStatus,
  };
})();
