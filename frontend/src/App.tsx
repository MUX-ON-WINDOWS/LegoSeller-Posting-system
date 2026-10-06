import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, BarChart3, Check, CircleDollarSign, Copy, ExternalLink, ImagePlus, LayoutDashboard, LockKeyhole, LogOut, PackagePlus, Sparkles, Trash2 } from "lucide-react";

type Listing = {
  id: number;
  set_number: string | null;
  set_name: string | null;
  theme: string | null;
  description: string | null;
  condition: string;
  is_complete: boolean;
  has_box: boolean;
  has_manual: boolean;
  status: string;
  photos: string[];
};

const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiUrl = (
  import.meta.env.PROD
    ? "/api"
    : (configuredApiUrl ?? `${window.location.protocol}//${window.location.hostname}:8000`)
).replace(/\/+$/, "");
const conditionLabels: Record<string, string> = { new: "Nieuw", excellent: "Uitstekend", good: "Goed", used: "Gebruikt" };

async function optimizePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error(`Foto optimaliseren is mislukt: ${file.name}`);
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

export default function App() {
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then((response) => {
        setAuthenticated(response.ok);
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail ?? "Inloggen is mislukt.");
      }
      setAuthenticated(true);
      setLoginPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Inloggen is mislukt.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    setAuthenticated(false);
    setListings([]);
    setSelectedListing(null);
  }

  async function copyDescription(description: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(description);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = description;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopiedDescription(true);
      window.setTimeout(() => setCopiedDescription(false), 2000);
    } catch {
      setMessage("Beschrijving kopiëren is mislukt.");
    }
  }

  useEffect(() => {
    if (authenticated !== true) return;
    fetch(`${apiUrl}/listings`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Advertenties konden niet worden geladen.");
        return response.json() as Promise<Listing[]>;
      })
      .then(setListings)
      .catch((error: Error) => setMessage(error.message));
  }, [authenticated]);

  function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setPhotos(selected.slice(0, 20));
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    if (photos.length < 1) {
      setMessage("Selecteer minimaal één foto.");
      return;
    }
    setSaving(true);
    try {
      const optimizedPhotos = await Promise.all(photos.map(optimizePhoto));
      const form = new FormData(formElement);
      optimizedPhotos.forEach((photo) => form.append("photos", photo));
      const response = await fetch(`${apiUrl}/listings`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail ?? "Opslaan is mislukt.");
      }
      const listing = await response.json();
      let resultMessage = "Advertentie opgeslagen.";
      const analysisResponse = await fetch(`${apiUrl}/listings/${listing.id}/analyze`, {
        method: "POST",
        credentials: "include",
      });
      if (analysisResponse.ok) {
        const recognition = await analysisResponse.json();
        resultMessage = recognition.set_number
          ? `Advertentie opgeslagen. Herkend: set ${recognition.set_number}.`
          : "Advertentie opgeslagen. Geen setnummer betrouwbaar herkend.";
      } else if (analysisResponse.status === 503) {
        resultMessage = "Advertentie opgeslagen. AI is nog niet geconfigureerd.";
      } else {
        const analysisError = await analysisResponse.json().catch(() => null);
        resultMessage = `Advertentie opgeslagen. AI-analyse mislukt: ${analysisError?.detail ?? `HTTP ${analysisResponse.status}`}`;
      }
      const refreshedListings = await fetch(`${apiUrl}/listings`, { credentials: "include" }).then((result) => result.json() as Promise<Listing[]>);
      setListings(refreshedListings);
      setPhotos([]);
      setMessage(resultMessage);
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  const openForm = () => {
    setMessage("");
    setShowForm(true);
  };

  const activeListings = listings.filter((listing) => listing.status === "active");
  const openPlatform = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  if (authenticated === null) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Laden...</div>;
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white"><LockKeyhole size={26} /></div>
          <h1 className="mt-6 text-center text-2xl font-bold">Welkom bij LegoSell AI</h1>
          <p className="mt-2 text-center text-sm text-slate-500">Log in om je advertenties te beheren.</p>
          <div className="mt-8 space-y-4">
            <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} required placeholder="Gebruikersnaam" autoComplete="username" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
            <input value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required type="password" placeholder="Wachtwoord" autoComplete="current-password" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
          </div>
          {loginError && <p className="mt-4 text-sm text-red-600">{loginError}</p>}
          <button disabled={loggingIn} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            <LockKeyhole size={17} /> {loggingIn ? "Inloggen..." : "Inloggen"}
          </button>
        </form>
      </main>
    );
  }

  async function deleteListing() {
    if (!selectedListing || !window.confirm("Weet je zeker dat je deze advertentie wilt verwijderen?")) return;
    setDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/listings/${selectedListing.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail ?? "Verwijderen is mislukt.");
      }
      setListings((current) => current.filter((listing) => listing.id !== selectedListing.id));
      setSelectedListing(null);
      setMessage("Advertentie verwijderd.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verwijderen is mislukt.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed hidden h-full w-64 border-r border-slate-200 bg-white p-6 lg:block">
        <div className="flex items-center gap-3 text-xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
            <Sparkles size={20} />
          </span>
          LegoSell <span className="text-blue-600">AI</span>
        </div>
        <nav className="mt-12 space-y-2 text-sm font-medium">
          <a className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-blue-700" href="#">
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <button onClick={openForm} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-500 hover:bg-slate-50">
            <PackagePlus size={18} /> Nieuwe advertentie
          </button>
        </nav>
      </aside>

      <main className="lg:ml-64">
        <header className="border-b border-slate-200 bg-white px-6 py-5 sm:px-10">
          <p className="text-sm font-medium text-blue-600">{showForm ? "Nieuwe advertentie" : "Overzicht"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{showForm ? "Advertentie toevoegen" : "Jouw LEGO advertenties"}</h1>
          <button type="button" onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><LogOut size={16} /> Uitloggen</button>
        </header>
        <div className="mx-auto max-w-7xl space-y-8 p-6 sm:p-10">
          {!showForm && (
            <section className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Actieve advertenties", value: String(activeListings.length), icon: LayoutDashboard },
                { label: "Verkocht", value: String(listings.filter((listing) => listing.status === "sold").length), icon: BarChart3 },
                { label: "Foto's verwerkt", value: String(listings.reduce((total, listing) => total + listing.photos.length, 0)), icon: CircleDollarSign },
              ].map(({ label, value, icon: Icon }) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{label}</p>
                    <Icon className="text-blue-600" size={20} />
                  </div>
                  <p className="mt-4 text-3xl font-bold">{value}</p>
                </article>
              ))}
            </section>
          )}
          {showForm ? (
            <form onSubmit={submitListing} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <button type="button" onClick={() => setShowForm(false)} className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                <ArrowLeft size={16} /> Terug naar dashboard
              </button>
              <div className="grid gap-6 lg:grid-cols-2">
                <label className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-blue-400">
                  <ImagePlus className="mx-auto text-blue-600" size={30} />
                  <span className="mt-3 block font-semibold">Foto&apos;s toevoegen</span>
                  <span className="mt-1 block text-sm text-slate-500">1 tot 20 foto&apos;s; mobiel maakt ze automatisch kleiner</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotos} className="sr-only" />
                  {photos.length > 0 && <span className="mt-4 block text-sm font-medium text-blue-700">{photos.length} foto&apos;s geselecteerd</span>}
                </label>
                <div className="space-y-4">
                  <input name="set_number" placeholder="Setnummer (bijv. 75192)" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                  <input name="set_name" placeholder="Setnaam (optioneel)" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                  <select name="condition" defaultValue="used" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <option value="new">Nieuw</option><option value="excellent">Uitstekend</option><option value="good">Goed</option><option value="used">Gebruikt</option>
                  </select>
                  <label className="flex items-center gap-3 text-sm"><input name="is_complete" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Compleet</label>
                  <label className="flex items-center gap-3 text-sm"><input name="has_box" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Doos aanwezig</label>
                  <label className="flex items-center gap-3 text-sm"><input name="has_manual" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Handleiding aanwezig</label>
                </div>
              </div>
              {message && <p className={`mt-5 text-sm ${message.includes("opgeslagen") ? "text-emerald-600" : "text-red-600"}`}>{message}</p>}
              <button disabled={saving} type="submit" className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Opslaan..." : "Advertentie opslaan"}
              </button>
            </form>
          ) : (
            <section className="space-y-6">
              {selectedListing ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <button type="button" onClick={() => setSelectedListing(null)} className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} /> Terug naar overzicht
                  </button>
                  <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedListing.photos.map((photo) => (
                        <img key={photo} src={`${apiUrl}${photo}`} alt={selectedListing.set_name ?? "LEGO advertentie"} className="aspect-square w-full rounded-xl object-cover" />
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600">{selectedListing.theme ?? "LEGO"} {selectedListing.set_number && `• ${selectedListing.set_number}`}</p>
                      <h2 className="mt-2 text-2xl font-bold">{selectedListing.set_name ?? "Onbenoemde LEGO-set"}</h2>
                                      {selectedListing.description && (
                                        <div className="mt-6 rounded-xl bg-slate-50 p-4">
                                          <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI-beschrijving</p>
                                            <button
                                              type="button"
                                              onClick={() => copyDescription(selectedListing.description!)}
                                              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
                                            >
                                              {copiedDescription ? <Check size={14} /> : <Copy size={14} />}
                                              {copiedDescription ? "Gekopieerd" : "Kopiëren"}
                                            </button>
                                          </div>
                                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedListing.description}</p>
                                        </div>
                                      )}
                      <dl className="mt-6 space-y-3 text-sm">
                        <div className="flex justify-between border-b border-slate-100 pb-3"><dt className="text-slate-500">Conditie</dt><dd className="font-medium">{conditionLabels[selectedListing.condition] ?? selectedListing.condition}</dd></div>
                        <div className="flex justify-between border-b border-slate-100 pb-3"><dt className="text-slate-500">Compleet</dt><dd className="font-medium">{selectedListing.is_complete ? "Ja" : "Nee"}</dd></div>
                        <div className="flex justify-between border-b border-slate-100 pb-3"><dt className="text-slate-500">Doos / handleiding</dt><dd className="font-medium">{selectedListing.has_box ? "Doos" : ""}{selectedListing.has_box && selectedListing.has_manual ? " + " : ""}{selectedListing.has_manual ? "handleiding" : !selectedListing.has_box ? "Geen" : ""}</dd></div>
                      </dl>
                      <p className="mt-6 text-sm text-slate-500">Open een platform om de advertentie met je foto&apos;s en deze gegevens handmatig te plaatsen.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => openPlatform("https://www.vinted.nl/items/new")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Naar Vinted <ExternalLink size={16} /></button>
                        <button type="button" onClick={() => openPlatform("https://www.marktplaats.nl/plaats")} className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600">Naar Marktplaats <ExternalLink size={16} /></button>
                      </div>
                      <button type="button" onClick={deleteListing} disabled={deleting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                        <Trash2 size={16} /> {deleting ? "Verwijderen..." : "Advertentie verwijderen"}
                      </button>
                    </div>
                  </div>
                </article>
              ) : listings.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {listings.map((listing) => (
                    <button type="button" key={listing.id} onClick={() => setSelectedListing(listing)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                      {listing.photos[0] ? <img src={`${apiUrl}${listing.photos[0]}`} alt="" className="h-48 w-full object-cover" /> : <div className="grid h-48 place-items-center bg-slate-100 text-slate-400"><ImagePlus /></div>}
                      <div className="p-5">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-600">{listing.theme ?? "LEGO"} {listing.set_number && `• ${listing.set_number}`}</p>
                        <h2 className="mt-2 font-semibold">{listing.set_name ?? "Onbenoemde LEGO-set"}</h2>
                        <p className="mt-2 text-sm text-slate-500">{conditionLabels[listing.condition] ?? listing.condition} • {listing.photos.length} foto&apos;s</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><PackagePlus size={26} /></div>
                  <h2 className="mt-5 text-xl font-semibold">Maak je eerste advertentie</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Upload 1 tot 20 foto&apos;s. LegoSell AI herkent de set en toont hem hier klaar voor publicatie.</p>
                  <button onClick={openForm} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Nieuwe advertentie</button>
                </section>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
