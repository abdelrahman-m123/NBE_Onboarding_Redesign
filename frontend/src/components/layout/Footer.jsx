import { Landmark, Phone } from 'lucide-react'

export function Footer({ t }) {
  return (
    <footer className="site-footer">
      <div><Landmark size={19} /><span>National Bank of Egypt</span></div>
      <nav aria-label="Legal"><a href="#privacy">{t.footer.legal}</a><a href="#security">{t.footer.security}</a><a href="#accessibility">{t.footer.accessibility}</a><a href="tel:19623"><Phone size={14} /> 19623</a></nav>
    </footer>
  )
  
}
