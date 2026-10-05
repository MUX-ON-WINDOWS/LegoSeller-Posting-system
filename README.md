# LegoSell AI

Lokale webapp voor het maken van LEGO-advertenties voor Marktplaats en Vinted.

## Architectuur

```text
LegoSell AI/
├── backend/                 # Python 3.12 + FastAPI
│   ├── app/
│   │   ├── api/             # HTTP-routes
│   │   ├── core/            # configuratie en database
│   │   ├── models/          # SQLAlchemy-modellen
│   │   ├── schemas/         # Pydantic-contracten
│   │   ├── services/        # herkenning, prijsadvies en generatie
│   │   └── main.py
│   ├── tests/
│   └── pyproject.toml
├── frontend/                # React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── types/
│   └── package.json
├── data/                    # lokale SQLite-database en uploads (gitignored)
├── package.json             # start beide services met npm start
├── scripts/start.mjs        # lokale process-start zonder Docker
└── .env.example
```

## Lokale ontwikkeling

### Installeren

Installeer Python 3.12+ en Node.js 20+ en voer vanuit de projectroot uit:

```powershell
npm run install:all
cd backend
python -m pip install -e ".[dev]"
cd ..
```

Als npm op Windows een certificaatfout geeft bij `npm run install:all`, voer dan de frontend-installatie opnieuw uit nadat Node/npm correct toegang tot het npm-register heeft:

```powershell
npm install --prefix frontend --strict-ssl=false
```

`--strict-ssl=false` is alleen een tijdelijke workaround voor een lokale bedrijfsproxy of antivirus die een eigen certificaat gebruikt. Zet daarna de normale npm-certificaatconfiguratie terug zodra de oorzaak is opgelost.

### Starten

Start daarna de volledige app met:

```powershell
npm start
```

Dit start automatisch beide services:

- Frontend: http://localhost:5173
- Backend/API-documentatie: http://localhost:8000/docs
- Healthcheck: http://localhost:8000/health

Stoppen kan met `Ctrl+C`.

`npm start` gebruikt geen Docker en heeft geen extra globale npm-tools nodig.

### Los starten

Frontend:

```powershell
cd frontend
npm run dev
```

Backend:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend
```

## Ontwerpkeuzes

- De app draait volledig lokaal; uploads worden in `data/uploads` opgeslagen.
- `npm start` gebruikt geen Docker en start de React- en FastAPI-processen naast elkaar.
- `VisionProvider` is een interface. De eerste versie gebruikt een veilige placeholder en kan later worden gekoppeld aan een lokaal vision-model.
- Prijsadvies en advertentieteksten zitten achter services, zodat deze domeinlogica onafhankelijk van HTTP en UI getest kan worden.
- Alle API-modellen zijn expliciet getypeerd met Pydantic.
- De frontend gebruikt automatisch dezelfde hostnaam voor de API. Daardoor werkt de app ook via een lokaal netwerkadres, zoals een Tailscale-adres.

### AI-herkenning

De huidige versie slaat foto’s lokaal op en maakt de advertentiegegevens aan. De daadwerkelijke LEGO-herkenning, OCR van tekst op dozen en herkenning van setnummer/setnaam zijn nog niet aangesloten. Daarvoor moet de `VisionProvider` in `backend/app/services/vision.py` worden gekoppeld aan een lokaal vision/OCR-model.

## Volgende stappen

1. Foto-upload en opslag toevoegen.
2. LEGO-herkenning koppelen aan een lokale of configureerbare AI-provider.
3. Prijsadvies en Marktplaats/Vinted-generatie implementeren.
4. Advertenties opslaan en dashboardstatistieken vullen.
