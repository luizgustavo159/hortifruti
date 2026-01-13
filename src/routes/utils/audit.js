const db = require("../../../db");

const logAudit = ({ action, details, performedBy, approvedBy }) => {
  db.run(
    "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
    [action, details ? JSON.stringify(details) : null, performedBy, approvedBy]
  );
};

module.exports = {
  logAudit,
};
