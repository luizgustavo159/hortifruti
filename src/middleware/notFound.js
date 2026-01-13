const notFound = (req, res) => {
  res.status(404).json({ message: "Rota não encontrada.", request_id: req.requestId });
};

module.exports = notFound;
