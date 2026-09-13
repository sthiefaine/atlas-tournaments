/** Diorama vectoriel original : aucun GLB ni texture lourde à charger dans le menu. */
export function Theatre(): React.ReactElement {
  return <svg viewBox="0 0 700 620" fill="none" aria-hidden="true">
    <defs><linearGradient id="menu-eau" x2="0" y2="1"><stop stopColor="#58cad0"/><stop offset="1" stopColor="#287eaa"/></linearGradient><pattern id="menu-grille" width="48" height="28" patternUnits="userSpaceOnUse"><path d="M0 28 48 0M0 0 48 28" stroke="#b3ffff" strokeOpacity=".12"/></pattern></defs>
    <ellipse cx="352" cy="503" rx="263" ry="64" fill="#061b2c" opacity=".4"/>
    <path d="M67 307 344 147 631 313 354 475Z" fill="#78aaa1"/>
    <path d="m67 307 287 168v37L67 344Z" fill="#294e60"/><path d="m354 475 277-162v37L354 512Z" fill="#1b3e54"/>
    <path d="M67 307 344 147 631 313 354 475Z" fill="#8cbc76"/>
    <path d="m242 207 65-38 287 167-65 38Z" fill="url(#menu-eau)"/><path d="m242 207 65-38 287 167-65 38Z" fill="url(#menu-grille)"/>
    <path d="m104 327 277-160 29 17-277 160Z" fill="#d8d3a4"/>
    <path d="m121 323 262-152" stroke="#717c70" strokeWidth="12"/><path d="m121 323 262-152" stroke="#e9e6bc" strokeWidth="2" strokeDasharray="8 10"/>
    <path d="m331 453 273-156 28 16-278 161Z" fill="#d8d3a4"/>
    <path d="m349 453 260-151" stroke="#717c70" strokeWidth="12"/><path d="m349 453 260-151" stroke="#e9e6bc" strokeWidth="2" strokeDasharray="8 10"/>
    <path d="m196 277 50-29 54 31-50 30Z" fill="#ecdfb8" stroke="#415e68" strokeWidth="5"/>
    <path d="m455 388 50-29 54 31-50 30Z" fill="#ecdfb8" stroke="#415e68" strokeWidth="5"/>
    {[[171,276],[214,365],[409,251],[444,275],[537,323],[291,399]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><ellipse cy="10" rx="20" ry="10" fill="#3c7253"/><path d="M-4 2h8v18h-8Z" fill="#657057"/><path d="M-23 5 0-48 23 5 0 17Z" fill="#347554"/><path d="M0-48V17L23 5Z" fill="#215543"/><path d="M-18-10 0-51 18-10 0-1Z" fill="#459568"/></g>)}
    <g transform="translate(351 274)"><path d="m-45 10 45-26 51 30-45 26Z" fill="#497255"/><path d="M-36-22 1-43 42-19v44L5 47-36 23Z" fill="#ebdcb7"/><path d="m1-43 41 24v44L5 47V-20Z" fill="#b5b99d"/><path d="m-44-24 42-43 53 38L5-4Z" fill="#3d687c"/><path d="m-2-67 53 38L5-4Z" fill="#214555"/><path d="M-25-10v17l11 6V-4m30 1v17l10-6V-9" fill="#50788c"/><path d="M-9 11v26l12 7V18Z" fill="#406578"/><path d="M33-51v-55" stroke="#d4e3d8" strokeWidth="4"/><path d="m35-103 32 10-32 10Z" fill="#ffcf71"/></g>
    <g transform="translate(243 331)"><path d="m-36 0 44-25 44 25-44 25Z" fill="#203d47"/><path d="m-36 0 44 25v12l-44-25Zm44 25L52 0v12L8 37Z" fill="#152e3b"/><path d="m-33-9 40-23 42 24-40 24Z" fill="#e4bc60"/><path d="m-33-9 42 25v10L-33 2Z" fill="#ad8848"/><path d="m-15-23 24-14 23 14-24 14Z" fill="#f4d380"/><path d="m9-9 23-14v11L9 2Z" fill="#bf9953"/><path d="m13-29 35-19 7 5-34 20Z" fill="#e4c16d"/></g>
    <path d="M100 433q69 42 121 60M472 190q76 22 145 79" stroke="#d0ffed" strokeOpacity=".5" strokeWidth="2" strokeDasharray="5 9"/>
    <circle cx="109" cy="428" r="8" fill="#f7d77d"/><circle cx="623" cy="276" r="8" fill="#f7d77d"/>
  </svg>;
}
