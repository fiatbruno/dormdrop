const savedItemsConfig = {
  // Your backend teammate fills these three settings in.
  listPath: null,
  selectItems: null,
  unsaveRequest: null,

  detailPath: (id) =>
    `/items/${encodeURIComponent(id)}`,
};

export default savedItemsConfig;