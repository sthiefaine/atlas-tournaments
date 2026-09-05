/** Portrait radio vectoriel : reste net à toutes les tailles, sans requête réseau. */
export function PortraitCommandant({ allie = false }: { allie?: boolean }): React.ReactElement {
  return <svg viewBox="0 0 160 190" className="atlas-portrait" aria-hidden="true">
    <path fill={allie ? '#d9b56c' : '#73a5a1'} d="M0 0h160v190H0z"/>
    <path stroke="#fff" opacity=".12" strokeWidth="1" d="M0 25h160M0 50h160M0 75h160M0 100h160M0 125h160M0 150h160M0 175h160M25 0v190M50 0v190M75 0v190M100 0v190M125 0v190M150 0v190"/>
    <path fill="#203a42" d="M13 190v-25q4-29 46-34h42q42 5 47 34v25"/>
    <path fill="#e6b88e" d="M65 110h30v34l-15 12-15-12z"/>
    <path fill="#27333a" d="M45 102V58q0-29 36-29 35 0 37 32v67l-23 7H57z"/>
    <path fill="#f1c7a0" d="M53 64h55v39q-3 27-28 28-24-4-27-28z"/>
    <path fill="#dba580" d="M81 74v31l9 2-9 5 20-1 7-17V64H81z"/>
    <path fill="#26323a" d="m53 70-4-9 18-14 43 9-2 17-29-11-9 9z"/>
    <path fill="#284e50" d="M38 53q-5-29 38-31 43-5 48 22l-14 17-56 4z"/>
    <path fill="#163437" d="m48 61 62-9 7 8-13 10-51 3z"/>
    <path fill="#e4c677" d="m70 37 6-4 6 4v9l-6 4-6-4z"/>
    <path stroke="#343436" strokeWidth="3" strokeLinecap="round" d="M60 83h11m20 0h10"/>
    <path stroke="#946352" strokeWidth="2" strokeLinecap="round" d="M72 115h16"/>
    <path fill="#122a33" d="M45 80h9v27h-9z"/>
    <path stroke="#122a33" fill="none" strokeWidth="4" d="M47 100v15q2 9 23 9"/>
    <rect fill="#152c34" x="66" y="121" width="12" height="6" rx="3"/>
    <path fill="#49716d" d="m59 135 21 21-18 15-16-30m55-6-21 21 18 15 16-30"/>
    <path stroke="#142d34" strokeWidth="3" d="M80 157v33"/>
    <path fill="#d8bf79" d="M110 162h17v4h-17zm0 7h17v4h-17z"/>
    <path fill="#b9d4ce" d="M29 151h12v5H29z"/>
  </svg>;
}
