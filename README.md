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

### Deployen met Vercel

Deze repository bevat een `vercel.json` die de frontend als statische Vite-build en de
backend als Python Function bouwt:

- `frontend`: Vite-build op `/`
- `api/index.py`: FastAPI op `/api/*`

De root [`requirements.txt`](requirements.txt) importeert de backend-dependencies uit
`backend/requirements.txt`, zodat Vercel de Python Function volledig kan bouwen.

Importeer de repository in Vercel en laat de project-root op de repository-root staan.
Vercel bouwt beide onderdelen samen. Voeg in de Vercel Project Settings de volgende
environment variables toe voor de backend en redeploy daarna:

```text
GOOGLE_AI_API_KEY
GOOGLE_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_AI_MODEL=gemini-2.5-flash-lite
```

Vercel Functions hebben geen permanente lokale schijf. Daarom ondersteunt de backend
voor productie een externe PostgreSQL-database via `DATABASE_URL` of `POSTGRES_URL`.
Advertenties en de bijbehorende foto's worden daarin opgeslagen, zodat ze blijven bestaan
na een nieuwe deployment, cold start of het afsluiten van je apparaat. Foto's worden als
databasegegevens opgeslagen; hiervoor is geen aparte Vercel Blob-configuratie nodig.

Maak in Vercel een PostgreSQL-database aan via de Marketplace (bijvoorbeeld Neon) en
koppel die aan dit project. Controleer daarna bij Project Settings → Environment Variables
dat `POSTGRES_URL` of `DATABASE_URL` aanwezig is voor Production en Preview. De URL moet
de PostgreSQL-verbinding bevatten, bijvoorbeeld:

```text
postgresql://user:password@host/database?sslmode=require
```

Na een redeploy maakt de backend automatisch de tabellen aan. De bestaande gegevens die
alleen in de oude `/tmp`-database stonden kunnen niet worden teruggehaald; die tijdelijke
schijf wordt door Vercel gewist. Nieuwe advertenties worden vanaf dat moment permanent
opgeslagen in PostgreSQL.

Als er lokaal geen PostgreSQL-variabele is ingesteld, blijft de lokale SQLite-database
(`data/legosell.db`) actief. Op Vercel start de backend bewust niet zonder PostgreSQL,
zodat er nooit ongemerkt nieuwe gegevens op tijdelijke opslag terechtkomen.

### Google AI Studio instellen

Maak in [Google AI Studio](https://aistudio.google.com/app/apikey) een API-sleutel aan,
kopieer `.env.example` naar `.env` en vul de sleutel in:

```dotenv
GOOGLE_AI_API_KEY=je_google_ai_studio_sleutel
GOOGLE_AI_MODEL=gemini-2.5-flash-lite
AUTH_USERNAME=jouw gebruikersnaam
AUTH_PASSWORD=een sterk wachtwoord
AUTH_SECRET=een lange willekeurige geheime waarde
```

De sleutel blijft uitsluitend in de backend. Foto's worden vanuit de backend naar de
Google Gemini API gestuurd voor herkenning van het LEGO-setnummer, de naam, het thema
en de conditie. Zet de sleutel nooit in de frontend of commit `.env` naar Git.

De applicatie gebruikt een single-user login met een HttpOnly sessiecookie. Stel
`AUTH_USERNAME`, `AUTH_PASSWORD` en een lange unieke `AUTH_SECRET` in bij Vercel.
De frontend bevat ook een PWA-manifest en een LegoSell-favicon.

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
- De AI-herkenning gebruikt Google AI Studio via de Gemini `generateContent` API.
- Het dashboard toont opgeslagen advertenties met foto's en biedt knoppen naar de nieuwe-advertentiepagina's van Vinted en Marktplaats. De uiteindelijke plaatsing blijft handmatig; beide platforms vereisen hiervoor een ingelogd account.
- Prijsadvies en advertentieteksten zitten achter services, zodat deze domeinlogica onafhankelijk van HTTP en UI getest kan worden.
- Alle API-modellen zijn expliciet getypeerd met Pydantic.
- De frontend gebruikt automatisch dezelfde hostnaam voor de API. Daardoor werkt de app ook via een lokaal netwerkadres, zoals een `10.x`, `192.168.x`, `172.16-31.x` of Tailscale-adres. De ontwikkel-API staat deze private netwerk-origins standaard toe via CORS.

### AI-herkenning

De app slaat foto's lokaal op en stuurt ze bij analyse vanuit de backend naar Google AI
Studio. OCR van tekst op dozen en herkenning van setnummer/setnaam gebeurt door Gemini.

## Volgende stappen

1. Foto-upload en opslag toevoegen.
2. Google AI Studio verder uitbreiden met prijsadvies en advertentiegeneratie.
3. Prijsadvies en Marktplaats/Vinted-generatie implementeren.
4. Advertenties opslaan en dashboardstatistieken vullen.
