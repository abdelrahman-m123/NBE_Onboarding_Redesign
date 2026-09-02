import { Building2, CircleHelp, Menu, Save, X } from 'lucide-react'

export function Header({ onSave, mobileNavOpen, setMobileNavOpen, language, toggleLanguage, onOpenCrm, t }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#main-content" aria-label="National Bank of Egypt home">
          <img className="brand-logo" src="/image.png" alt="" />
        </a>
        <nav className={`header-actions ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Support navigation">
          <button
            type="button"
            className="header-link"
            onClick={onOpenCrm}
            style={{ color: '#006643', fontWeight: '700' }}
          >
            <Building2 size={18} /> Staff CRM
          </button>
          <button type="button" className={`lang-toggle ${language === 'ar' ? 'is-ar' : 'is-en'}`} onClick={toggleLanguage} aria-label={t.languageLabel}>
            <span className="lang-toggle-track">
              <span className="lang-toggle-label en">EN</span>
              <span className="lang-toggle-label ar">عربي</span>
              <span className="lang-toggle-thumb" aria-hidden="true" />
            </span>
          </button>
          <button type="button" className="header-link" onClick={() => alert('Call NBE support at 19623 for assistance.')}>
            <CircleHelp size={18} aria-hidden="true" /> {t.help}
          </button>
          <button type="button" className="save-button" onClick={onSave}>
            <Save size={17} aria-hidden="true" /> {t.saveExit}
          </button>
        </nav>
        <button
          type="button"
          className="menu-button"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  )
}
