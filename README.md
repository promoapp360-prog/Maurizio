# City Salon Maurizio Melella — Salerno

Sito pubblico + prenotazioni online + gestionale completo per il salone.

## Avvio su Replit
1. Replit → **Create Repl → Import from GitHub** → `promoapp360-prog/Maurizio`
2. Premi **Run** (nessuna dipendenza da installare, Node puro)
3. Sito: `/` — Gestionale: `/admin`

**Password admin:** `Maurizio` (modificabile con il Secret `ADMIN_PASSWORD` su Replit)

## Funzioni
- **Sito**: hero, chi siamo, listino servizi con filtri, galleria, prenotazione in 3 step, contatti con mappa e orari, pulsante WhatsApp
- **Prenotazioni online**: slot liberi calcolati su orari, durata servizio e operatore (niente sovrapposizioni)
- **Gestionale**: dashboard incassi/KPI, agenda giornaliera per operatore, prenotazioni con filtri e stati (confermata, completata, non presentato, annullata), schede clienti con visite e spesa, promemoria WhatsApp, listino servizi, staff, orari e dati salone, backup JSON

## Dati
Salvati in `data/db.json` (creato al primo avvio). Per non perderli usare il **Deployment Reserved VM** e scaricare periodicamente il backup da Impostazioni.

Le immagini sono provvisorie (Unsplash): sostituirle con foto reali del salone.
