(() => {
  const initNotes = ({ addNoteButton, noteModal, noteInput, noteForm, state, setFeedback }) => {
    addNoteButton?.addEventListener("click", () => {
      if (!noteModal) {
        return;
      }
      noteInput.value = state.saleNote || "";
      noteModal.show();
    });

    noteForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.saleNote = noteInput.value.trim();
      noteModal.hide();
      if (state.saleNote) {
        setFeedback("Observação salva na venda atual.", "info");
      }
    });
  };

  window.posNotes = {
    initNotes,
  };
})();
