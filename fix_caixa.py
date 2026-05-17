import re

path = '/home/ubuntu/hortifruti/frontend/src/pages/Caixa.jsx'
content = open(path).read()

# 1. Adicionar botão de Abrir Caixa e status na search-section
search_section_replacement = """          <div className="search-section" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ flex: 1 }}
            />
            {!caixaAberto && (
              <button 
                className="button button-primary" 
                onClick={() => setShowAberturaModal(true)}
                style={{ whiteSpace: 'nowrap', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔓 Abrir Caixa
              </button>
            )}
            {caixaAberto && (
              <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🟢 Caixa Aberto
              </span>
            )}
          </div>"""

# Substituir a search-section antiga (lidando com possíveis variações de espaço)
content = re.sub(r'<div className="search-section">.*?</div>', search_section_replacement, content, flags=re.DOTALL)

# 2. Adicionar botão de Cancelar no modal
if 'button-secondary' not in content:
    cancel_button = """                <button type="button" className="button button-secondary" onClick={() => setShowAberturaModal(false)} style={{ marginRight: '10px' }}>
                  Cancelar
                </button>
                <button type="submit" """
    content = content.replace('<button type="submit"', cancel_button)

with open(path, 'w') as f:
    f.write(content)
