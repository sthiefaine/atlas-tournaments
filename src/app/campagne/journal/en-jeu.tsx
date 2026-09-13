'use client';
import { useEffect, useRef, useMemo } from 'react';
import Journal from './journal';
import { donneesJournal } from './donnees';
export default function CarnetEnJeu({ fermer }: { fermer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const donnees = useMemo(donneesJournal, []);
  useEffect(() => {
    const dialog = ref.current, avant = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (avant instanceof HTMLElement && avant.isConnected) avant.focus(); };
  }, []);
  return <dialog ref={ref} aria-label="Carnet de campagne" onCancel={e => { e.preventDefault(); fermer(); }} onKeyDown={e => e.stopPropagation()} style={{position:'fixed',inset:0,width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',padding:0,margin:0,border:0,background:'#0c202d',color:'#edf7f6',overflow:'auto'}}><Journal {...donnees} fermer={fermer}/></dialog>;
}
