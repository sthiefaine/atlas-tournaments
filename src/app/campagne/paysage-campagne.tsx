/** Carte originale, géographie illustrative du parcours et non frontières réelles. */
export function PaysageCampagne({ prefixe }: { prefixe: string }): React.ReactElement {
  const cote = 'M-40 56 Q75 10 166 62L215 40 263 83 338 66 393 103 451 64 519 88 573 42 659 69 714 43 781 91 867 75 932 118 1064 73 1240 131V900H683L706 807 654 759 611 746 590 690 537 656 496 606 439 590 420 545 376 521 368 463 312 433 298 394 238 369 208 303 135 287 127 232 63 224 31 165-40 149Z';
  return <svg viewBox="0 0 1200 880" role="presentation" aria-hidden="true">
    <defs>
      <linearGradient id={`${prefixe}-eau`} x2="1" y2="1"><stop stopColor="#173e51"/><stop offset="1" stopColor="#0c273a"/></linearGradient>
      <linearGradient id={`${prefixe}-terre`} x2=".8" y2="1"><stop stopColor="#8d9c78"/><stop offset=".55" stopColor="#697e65"/><stop offset="1" stopColor="#b0ab83"/></linearGradient>
      <pattern id={`${prefixe}-grille`} width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#d5e6d8" strokeOpacity=".07"/></pattern>
      <pattern id={`${prefixe}-champs`} width="48" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path d="M0 0H48V32H0Z" fill="#b4b284"/><path d="M4 0V32M10 0V32M16 0V32M22 0V32M28 0V32M34 0V32M40 0V32" stroke="#819472" strokeWidth="2"/></pattern>
      <clipPath id={`${prefixe}-continent`}><path d={cote}/></clipPath>
      <g id={`${prefixe}-sapin`}><path d="M0 7V15" stroke="#354738" strokeWidth="3"/><path d="M-10 8 0-16 10 8Z" fill="#2d554b"/><path d="M0-16V8H10Z" fill="#416959"/></g>
      <g id={`${prefixe}-sommet`}><path d="M-45 28 0-50 48 28 17 19-5 31Z" fill="#647269"/><path d="M0-50 48 28 15 17 3-7Z" fill="#424f4d"/><path d="M-13-28 0-50 16-24 5-29 1-20-5-31Z" fill="#e4e4cf"/><path d="M-35 32 2 39 45 32" fill="none" stroke="#526359" opacity=".5"/></g>
    </defs>
    <rect width="1200" height="880" fill={`url(#${prefixe}-eau)`}/>
    <path d={cote} fill="none" stroke="#77a6a0" strokeOpacity=".12" strokeWidth="54"/><path d={cote} fill="none" stroke="#82b3a5" strokeOpacity=".22" strokeWidth="27"/>
    <path d={cote} fill={`url(#${prefixe}-terre)`} stroke="#c7c39c" strokeWidth="6"/>
    <g clipPath={`url(#${prefixe}-continent)`}>
      <path d="M600 35Q750 170 670 280T810 570L1250 620V0Z" fill="#879077"/>
      <path d="M70 200Q260 70 460 210T650 510T930 710" fill="none" stroke="#c5c49a" strokeWidth="110" opacity=".13"/>
      {[0,1,2,3,4,5].map(i=><path key={i} d={`M${580+i*18} 0Q${490+i*24} 170 ${710+i*16} 315T${800+i*21} 640T${960+i*17} 930`} fill="none" stroke="#d1d4b3" strokeWidth="1.2" opacity=".23"/>)}
      <path d="M135 120 290 111 315 223 234 270 166 239Z M375 280 482 248 539 332 499 411 406 375Z M699 580 839 539 881 658 750 724Z" fill={`url(#${prefixe}-champs)`} opacity=".48" stroke="#a3ad85" strokeWidth="5"/>
      <path d="M1032 44Q929 173 991 256T937 418Q904 498 820 476T673 547Q604 623 552 643" fill="none" stroke="#b9c3a0" strokeWidth="18"/>
      <path d="M1032 44Q929 173 991 256T937 418Q904 498 820 476T673 547Q604 623 552 643" fill="none" stroke="#4f8894" strokeWidth="10"/>
      <path d="M726 99Q703 208 785 249T966 337" fill="none" stroke="#4f8894" strokeWidth="5"/>
      <path d="M892 469Q922 450 955 467L947 482 909 489Z" fill="#548e9a"/>
      {[[460,138],[488,160],[520,133],[556,164],[583,131],[619,153],[654,119],[674,177],[699,155],[717,201],[751,185],[1084,538],[1124,563],[1154,513]].map(([x,y],i)=><use key={i} href={`#${prefixe}-sommet`} transform={`translate(${x} ${y}) scale(${i%3===0?1.3:.9})`}/>)}
      {[[324,171],[344,154],[347,192],[374,168],[362,215],[595,355],[619,337],[639,361],[660,339],[682,367],[652,395],[702,393],[725,361],[736,410],[1020,665],[1042,638],[1062,669],[1082,647],[1104,679],[1123,660],[1150,690]].map(([x,y],i)=><use key={i} href={`#${prefixe}-sapin`} transform={`translate(${x} ${y}) scale(1.6)`}/>)}
      <path d="M162 353Q280 310 391 395T665 430T920 615T1170 700" fill="none" stroke="#424f45" strokeWidth="8" opacity=".5"/><path d="M162 353Q280 310 391 395T665 430T920 615T1170 700" fill="none" stroke="#beb899" strokeWidth="3"/>
      <path d="M150 286L213 295M155 298L210 307M158 310L205 319" stroke="#d2cbb1" strokeWidth="5"/>
      <g fill="#d2cbb2" stroke="#526456" strokeWidth="2">{[[260,136],[277,132],[266,155],[854,307],[872,315],[849,329],[884,333],[1038,711],[1055,724],[1069,708]].map(([x,y],i)=><path key={i} d={`M${x} ${y}l12-4 4 15-12 4Z`}/>)}</g>
    </g>
    <rect width="1200" height="880" fill={`url(#${prefixe}-grille)`}/>
    <g fill="#d2ded7" fontFamily="system-ui, sans-serif" fontSize="12" letterSpacing="5" opacity=".65"><text x="370" y="97">HAUTS PLATEAUX</text><text x="665" y="760">VALLÉE CENTRALE</text><text x="72" y="510" transform="rotate(-25 72 510)">CÔTE OCCIDENTALE</text></g>
    <g transform="translate(104 735)" fill="none" stroke="#9ebabb" opacity=".7"><circle r="30"/><path d="M0-42V42M-42 0H42"/><path d="M0-32 8 0 0-6-8 0Z" fill="#c8d6ce"/><text y="-51" textAnchor="middle" stroke="none" fill="#c8d6ce" fontSize="12">N</text></g>
    <g transform="translate(55 835)" stroke="#9ebabb" opacity=".55"><path d="M0-4V4M0 0H120M60-4V4M120-4V4"/><text x="0" y="-13" fill="#c8d6ce" stroke="none" fontSize="9" letterSpacing="2">CARTE DES OPÉRATIONS</text></g>
  </svg>;
}
