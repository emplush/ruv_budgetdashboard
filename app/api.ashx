<%@ WebHandler Language="C#" Class="BudgetApi" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>
/*
 * Budgetdashboard: Datenschnittstelle für den IIS (ASP.NET 4.7.2 oder neuer, ohne Datenbank).
 *
 * Daten: App_Data\daten.json (wird beim ersten Aufruf mit dem Administrator xv00000 angelegt).
 * Vor jeder Änderung sichert der Server den alten Stand nach App_Data\sicherungen (die letzten 50 bleiben).
 * Jeder Aufruf braucht den Kopf "X-Budgetdashboard: 1". Die Anmeldung läuft über ein HttpOnly-Cookie und gilt 7 Tage
 * (bis zum Abmelden). Die Sitzungen liegen als Hash in App_Data\sitzungen.json und überstehen einen Neustart.
 *
 *   GET  ping                    -> {"ok":true,"modus":"server","version"}
 *   GET  oeffentlich             -> {"einstellungen":{titel}}                          (ohne Anmeldung)
 *   GET  sitzung                 -> Sicht oder 401
 *   POST anmelden                <- {kennung,passwort} -> Sicht, setzt Cookie; 401 bei falschen Daten
 *   POST abmelden
 *   POST passwort                <- {alt|null,neu}   (alt null nur bei der ersten Anmeldung mit Einmalpasswort)
 *   POST profil                  <- {vorname,nachname}                                  (eigenes Konto)
 *   POST design                  <- {design,farbe}                                      (eigenes Konto)
 *   POST einstellungen           <- {titel}                                             (Administrator)
 *   POST benutzer-anlegen        <- {kennung,vorname,nachname,rolle,nummern:{ks,pn},passwort}  (Administrator, Abteilungsleitung)
 *   POST benutzer-aendern        <- {kennung,vorname,nachname,rolle,nummern:{ks,pn}}   (Administrator, Abteilungsleitung)
 *   POST benutzer-loeschen       <- {kennung}                                           (Administrator, Abteilungsleitung)
 *   POST passwort-zuruecksetzen  <- {kennung,passwort}  setzt ein Einmalpasswort       (Administrator, Abteilungsleitung)
 *   POST nummer-speichern        <- {art:"ks"|"pn",alt,nummer,benutzer:[kennung],unter?:[nummer]} (Administrator, Abteilungsleitung;
 *                                   unter nur bei Kostenstellen: zugeordnete Kostenstellen einer übergreifenden Kostenstelle, fehlt es, bleibt die Zuordnung)
 *   POST nummer-loeschen         <- {art,nummer}                                        (Administrator, Abteilungsleitung)
 *   POST ist-importieren         <- {nummer,eintrag:{stand,monat,aktuell:{jahr,werte},vorjahrZeitraum,vorjahr,datei}} (Abteilungsleitung;
 *                                   ersetzt die IST-Daten der Kostenstelle, sichert vorher den bisherigen Stand in istSicherungen)
 *   POST kosten-speichern        <- {id,pn,datum,kostenart,betrag,text}                (Abteilungsleitung; Projektkosten, id leer = neu)
 *   POST kosten-loeschen         <- {id}                                               (Abteilungsleitung)
 *   POST ist-wiederherstellen    <- {id}                                               (Administrator, Abteilungsleitung)
 *   POST budget-speichern        <- {jahr,art,nummer,werte:{pkId,pkAd,werbung,reise,sonstiges}} (Abteilungsleitung)
 *
 * Jede Änderung antwortet mit der neuen Sicht = {"ich":kennung,"daten":{...}}, gleiche Regeln wie sicht() in js/daten.js:
 * Administrator und Abteilungsleitung sehen alle Benutzer, Kostenstellen und Projektnummern; Planbudgets sieht nur
 * die Abteilungsleitung vollständig. Gruppenleitung und Key Account Manager sehen nur sich selbst, ihre Nummern und
 * deren Planbudgets. Hash und Salz verlassen den Server nie, Einmalpasswörter nur in der Benutzerverwaltung.
 * Die Abteilungsleitung verwaltet alle Konten außer Administratoren.
 */
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Script.Serialization;

/// <summary>Dünne Hülle für den IIS. Die Logik steckt in BdKern (ohne HttpContext testbar).</summary>
public class BudgetApi : IHttpHandler
{
    public bool IsReusable { get { return true; } }

    public void ProcessRequest(HttpContext ctx)
    {
        string koerper = "";
        if (ctx.Request.HttpMethod == "POST" && ctx.Request.ContentLength <= BdKern.MaxBytes)
        {
            using (var leser = new StreamReader(ctx.Request.InputStream, Encoding.UTF8)) koerper = leser.ReadToEnd();
        }
        var cookie = ctx.Request.Cookies[BdKern.CookieName];
        var anfrage = new BdAnfrage
        {
            Methode = ctx.Request.HttpMethod,
            Aktion = ctx.Request.QueryString["aktion"],
            Kopf = ctx.Request.Headers["X-Budgetdashboard"],
            Koerper = koerper,
            Laenge = ctx.Request.ContentLength,
            Token = cookie != null ? cookie.Value : "",
            AppData = ctx.Server.MapPath("~/App_Data")
        };
        var e = BdKern.Verarbeiten(anfrage);

        ctx.Response.ContentType = "application/json";
        ctx.Response.ContentEncoding = Encoding.UTF8;
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        ctx.Response.Cache.SetNoStore();
        ctx.Response.AddHeader("X-Content-Type-Options", "nosniff");
        if (e.Cookie != null)
        {
            string pfad = ctx.Request.ApplicationPath ?? "/";
            if (!pfad.EndsWith("/")) pfad += "/";
            ctx.Response.AppendHeader("Set-Cookie", BdKern.CookieKopf(e.Cookie, pfad, ctx.Request.IsSecureConnection));
        }
        ctx.Response.StatusCode = e.Status;
        ctx.Response.TrySkipIisCustomErrors = true;
        ctx.Response.Write(e.Json);
    }
}

public class BdAnfrage
{
    public string Methode, Aktion, Kopf, Koerper, Token, AppData;
    public long Laenge;
}

public class BdErgebnis
{
    public int Status;
    public string Json;
    /// <summary>null: Cookie bleibt; "": Cookie löschen; sonst neues Token.</summary>
    public string Cookie;
    public BdErgebnis(int status, string json) { Status = status; Json = json; }
}

public static class BdKern
{
    public const string Version = "0.4.2";
    public const string CookieName = "budgetdashboard_sitzung";
    public const int MaxBytes = 2 * 1024 * 1024;
    private const int AnzahlSicherungen = 50;
    private const int Iterationen = 100000;
    private const int MaxFehlversuche = 5;
    private const decimal MaxBetrag = 999999999.99m;
    private static readonly TimeSpan Sperrzeit = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan SitzungsDauer = TimeSpan.FromDays(7);
    private const string StandardTitel = "Budgetdashboard";
    private const string StandardAdmin = "xv00000";
    private const string StandardPasswort = "RuV-Plan#2026!";

    private static readonly object Sperre = new object();
    /// <summary>Schlüssel ist der SHA-256 des Tokens, damit sitzungen.json keine gültigen Cookies enthält.</summary>
    private static readonly Dictionary<string, Sitzung> Sitzungen = new Dictionary<string, Sitzung>();
    private static bool sitzungenGeladen, sitzungenGeaendert;
    private static readonly Dictionary<string, Versuche> Fehlversuche = new Dictionary<string, Versuche>();

    private static readonly string[] Rollen = { "admin", "al", "gl", "kam" };
    private static readonly string[] Positionen = { "pkId", "pkAd", "werbung", "reise", "sonstiges" };
    private static readonly string[] Gaengig = { "passwort", "password", "qwertz", "qwerty", "123456", "abcdef", "willkommen", "budget", "geheim", "admin" };
    /// <summary>Farbdesigns aus js/design.js</summary>
    private static readonly HashSet<string> Farben = new HashSet<string> { "klassik", "wiesbaden", "rheingau", "taunus", "sandstein", "abendrot", "genossenschaft", "schiefer", "mitternacht", "rheinufer" };
    private static readonly Regex KennungMuster = new Regex("^xv[0-9]{5}$");
    private static readonly Regex JahrMuster = new Regex("^20[0-9]{2}$");

    private class Sitzung { public string Kennung; public DateTime Ablauf; }
    private class Versuche { public int Anzahl; public DateTime GesperrtBis; }

    private class Fehler : Exception
    {
        public int Status;
        public Fehler(int status, string text) : base(text) { Status = status; }
    }

    // ---------- Einstieg ----------

    public static BdErgebnis Verarbeiten(BdAnfrage a)
    {
        // Schutz gegen fremde Seiten: Nur Aufrufe aus dem Tool tragen diesen Kopf.
        if (a.Kopf != "1") return Antwort(403, new { fehler = "Aufruf nicht erlaubt." });
        string aktion = (a.Aktion ?? "").ToLowerInvariant();
        bool post = a.Methode == "POST";
        try
        {
            if (a.Laenge > MaxBytes) throw new Fehler(413, "Die Daten sind zu groß.");
            if (!Directory.Exists(a.AppData)) Directory.CreateDirectory(a.AppData);
            lock (Sperre)
            {
                if (aktion == "ping" && !post) return Antwort(200, new { ok = true, modus = "server", version = Version });
                SitzungenLaden(a.AppData);
                try { return Bearbeiten(a, aktion, post); }
                finally { if (sitzungenGeaendert) SitzungenSichern(a.AppData); }
            }
        }
        catch (Fehler f) { return Antwort(f.Status, new { fehler = f.Message }); }
        catch (Exception) { return Antwort(500, new { fehler = "Auf dem Server ist ein Fehler aufgetreten. Probiere es bitte noch einmal." }); }
    }

    private static BdErgebnis Bearbeiten(BdAnfrage a, string aktion, bool post)
    {
        string sitzung = Schluessel(a.Token);
        var daten = Laden(a.AppData);
        if (aktion == "oeffentlich" && !post) return Antwort(200, new { einstellungen = new { titel = S(D(daten["einstellungen"]), "titel") } });
        if (aktion == "anmelden" && post) return Anmelden(daten, Json(a.Koerper), a.AppData);
        if (aktion == "abmelden" && post)
        {
            if (sitzung != null && Sitzungen.Remove(sitzung)) sitzungenGeaendert = true;
            var r = Antwort(200, new { ok = true });
            r.Cookie = "";
            return r;
        }

        var ich = Angemeldet(daten, sitzung);
        if (aktion == "sitzung" && !post) return Antwort(200, Sicht(daten, ich));
        if (aktion == "passwort" && post) return PasswortAendern(daten, ich, Json(a.Koerper), a.AppData, sitzung);
        if (B(ich, "mussPasswortAendern")) throw new Fehler(403, "Lege bitte zuerst Dein eigenes Passwort fest.");
        if (!post) throw new Fehler(404, "Diese Aktion gibt es nicht.");

        var k = Json(a.Koerper);
        string rolle = S(ich, "rolle");
        bool verwaltet = rolle == "admin" || rolle == "al";
        switch (aktion)
        {
            case "profil":
                {
                    string v = Kuerzen(S(k, "vorname"), 41), n = Kuerzen(S(k, "nachname"), 41);
                    if (v == "" || n == "") throw new Fehler(400, "Gib bitte Deinen Vor- und Nachnamen ein.");
                    if (v.Length > 40 || n.Length > 40) throw new Fehler(400, "Vor- und Nachname haben höchstens 40 Zeichen.");
                    ich["vorname"] = v; ich["nachname"] = n;
                    break;
                }
            case "design":
                {
                    string design = S(k, "design"), farbe = S(k, "farbe");
                    if (design == "auto" || design == "hell" || design == "dunkel") ich["design"] = design;
                    if (farbe != null && Farben.Contains(farbe)) ich["farbe"] = farbe;
                    Speichern(daten, a.AppData, false);
                    return Antwort(200, new { ok = true });
                }
            case "einstellungen":
                {
                    if (rolle != "admin") throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    string t = Kuerzen(S(k, "titel"), 61);
                    if (t == "") throw new Fehler(400, "Gib dem Tool bitte einen Titel.");
                    if (t.Length > 60) throw new Fehler(400, "Der Titel hat höchstens 60 Zeichen.");
                    D(daten["einstellungen"])["titel"] = t;
                    break;
                }
            case "benutzer-anlegen":
            case "benutzer-aendern":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    bool neu = aktion == "benutzer-anlegen";
                    string kennung = (S(k, "kennung") ?? "").Trim().ToLowerInvariant();
                    var ziel = neu ? null : BenutzerPflicht(daten, kennung);
                    string vorname = Kuerzen(S(k, "vorname"), 41), nachname = Kuerzen(S(k, "nachname"), 41), neueRolle = S(k, "rolle") ?? "";
                    PruefeBenutzer(daten, ich, ziel, kennung, vorname, nachname, neueRolle);
                    if (neu)
                    {
                        string pw = S(k, "passwort") ?? "";
                        PasswortRegeln(pw, kennung, vorname, nachname, "Das Einmalpasswort");
                        ziel = NeuerBenutzer(kennung, vorname, nachname, neueRolle);
                        PasswortSetzen(ziel, pw, true);
                        L(daten["benutzer"]).Add(ziel);
                    }
                    else
                    {
                        ziel["vorname"] = vorname; ziel["nachname"] = nachname; ziel["rolle"] = neueRolle;
                    }
                    NummernSetzen(daten, ziel, G(k, "nummern") as Dictionary<string, object>);
                    break;
                }
            case "benutzer-loeschen":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    var ziel = BenutzerPflicht(daten, S(k, "kennung"));
                    if (!DarfKontoVerwalten(ich, ziel)) throw new Fehler(403, "Administratoren verwaltet nur ein Administrator.");
                    if (S(ziel, "kennung") == S(ich, "kennung")) throw new Fehler(400, "Du kannst Dein eigenes Konto nicht löschen.");
                    if (S(ziel, "rolle") == "admin" && AnzahlAdmins(daten) <= 1) throw new Fehler(400, "Es muss mindestens ein Administrator bleiben.");
                    string kz = S(ziel, "kennung");
                    L(daten["benutzer"]).Remove(ziel);
                    foreach (var art in new[] { "ks", "pn" })
                        foreach (var n in Liste(daten, art).Select(x => D(x))) n["benutzer"] = Kennungen(n).Where(x => x != kz).Cast<object>().ToList();
                    SitzungenBeenden(kz);
                    break;
                }
            case "passwort-zuruecksetzen":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    var ziel = BenutzerPflicht(daten, S(k, "kennung"));
                    if (!DarfKontoVerwalten(ich, ziel)) throw new Fehler(403, "Administratoren verwaltet nur ein Administrator.");
                    if (S(ziel, "kennung") == S(ich, "kennung")) throw new Fehler(400, "Dein eigenes Passwort änderst Du in Deinem Profil.");
                    string pw = S(k, "passwort") ?? "";
                    PasswortRegeln(pw, S(ziel, "kennung"), S(ziel, "vorname"), S(ziel, "nachname"), "Das Einmalpasswort");
                    PasswortSetzen(ziel, pw, true);
                    SitzungenBeenden(S(ziel, "kennung"));
                    break;
                }
            case "nummer-speichern":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    var unter = k.ContainsKey("unter") && k["unter"] != null ? L(k["unter"]).Select(x => x as string).Where(x => x != null).ToList() : null;
                    NummerSpeichern(daten, S(k, "art") ?? "", (S(k, "alt") ?? "").Trim(), (S(k, "nummer") ?? "").Trim(), L(G(k, "benutzer")).Select(x => x as string).Where(x => x != null).ToList(), unter, G(k, "ks") as string);
                    break;
                }
            case "nummer-loeschen":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    string art = S(k, "art") ?? "", nummer = S(k, "nummer") ?? "";
                    var eintrag = FindeNummer(daten, art, nummer);
                    if (eintrag == null) throw new Fehler(404, "Diese Nummer gibt es nicht mehr.");
                    Liste(daten, art).Remove(eintrag);
                    if (art == "pn") daten["kosten"] = L(daten["kosten"]).Where(x => S(D(x), "pn") != nummer).ToList();
                    if (art == "ks")
                    {
                        foreach (var p in L(daten["projekte"]).Select(x => D(x))) if (S(p, "ks") == nummer) p["ks"] = "";
                        foreach (var n in Liste(daten, "ks").Select(x => D(x)))
                            n["unter"] = Unter(n).Where(u => u != nummer).Cast<object>().ToList();
                        D(daten["ist"]).Remove("ks-" + nummer);
                        daten["istSicherungen"] = L(daten["istSicherungen"]).Where(x => S(D(x), "nummer") != nummer).ToList();
                    }
                    var budgets = D(daten["budgets"]);
                    foreach (var jahr in budgets.Keys.ToList())
                    {
                        var j = D(budgets[jahr]);
                        j.Remove(art + "-" + nummer);
                        if (j.Count == 0) budgets.Remove(jahr);
                    }
                    break;
                }
            case "ist-importieren":
                {
                    if (rolle != "al") throw new Fehler(403, "IST-Daten importiert nur die Abteilungsleitung.");
                    IstSetzen(daten, (S(k, "nummer") ?? "").Trim(), G(k, "eintrag") as Dictionary<string, object>, S(ich, "kennung"));
                    break;
                }
            case "kosten-speichern":
                {
                    if (rolle != "al") throw new Fehler(403, "Projektkosten erfasst nur die Abteilungsleitung.");
                    KostenSpeichern(daten, (S(k, "id") ?? "").Trim(), k, S(ich, "kennung"));
                    break;
                }
            case "kosten-loeschen":
                {
                    if (rolle != "al") throw new Fehler(403, "Projektkosten erfasst nur die Abteilungsleitung.");
                    string id = S(k, "id") ?? "";
                    var liste = L(daten["kosten"]).ToList();
                    if (!liste.Any(x => S(D(x), "id") == id)) throw new Fehler(404, "Diesen Eintrag gibt es nicht mehr.");
                    daten["kosten"] = liste.Where(x => S(D(x), "id") != id).ToList();
                    break;
                }
            case "ist-wiederherstellen":
                {
                    if (!verwaltet) throw new Fehler(403, "Dafür fehlen Dir die Rechte.");
                    IstWiederherstellen(daten, S(k, "id") ?? "", S(ich, "kennung"));
                    break;
                }
            case "budget-speichern":
                {
                    if (rolle != "al") throw new Fehler(403, "Planbudgets trägt nur die Abteilungsleitung ein.");
                    BudgetSetzen(daten, S(k, "jahr") ?? "", S(k, "art") ?? "", S(k, "nummer") ?? "", G(k, "werte") as Dictionary<string, object>);
                    break;
                }
            default:
                throw new Fehler(404, "Diese Aktion gibt es nicht.");
        }
        daten["stand"] = I(daten, "stand") + 1;
        Speichern(daten, a.AppData, true);
        return Antwort(200, Sicht(daten, Benutzer(daten, S(ich, "kennung"))));
    }

    public static string CookieKopf(string token, string pfad, bool https)
    {
        if (token == "") return CookieName + "=; Path=" + pfad + "; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict" + (https ? "; Secure" : "");
        return CookieName + "=" + token + "; Path=" + pfad + "; Max-Age=" + (int)SitzungsDauer.TotalSeconds + "; HttpOnly; SameSite=Strict" + (https ? "; Secure" : "");
    }

    // ---------- Anmeldung ----------

    private static BdErgebnis Anmelden(Dictionary<string, object> daten, Dictionary<string, object> k, string appData)
    {
        string kennung = (S(k, "kennung") ?? "").Trim().ToLowerInvariant();
        string passwort = S(k, "passwort") ?? "";
        if (!KennungMuster.IsMatch(kennung)) throw new Fehler(400, "Deine XV-Nummer besteht aus „xv“ und fünf Ziffern, zum Beispiel xv12345.");
        Versuche v;
        if (Fehlversuche.TryGetValue(kennung, out v) && v.GesperrtBis > DateTime.UtcNow)
            throw new Fehler(429, "Nach mehreren falschen Eingaben ist die Anmeldung für 15 Minuten gesperrt. Probiere es bitte danach noch einmal.");
        var b = Benutzer(daten, kennung);
        if (b == null || !PasswortPasst(b, passwort))
        {
            if (v == null || v.GesperrtBis > DateTime.MinValue && v.GesperrtBis <= DateTime.UtcNow) { v = new Versuche(); Fehlversuche[kennung] = v; }
            v.Anzahl++;
            if (v.Anzahl >= MaxFehlversuche) { v.GesperrtBis = DateTime.UtcNow.Add(Sperrzeit); v.Anzahl = 0; }
            throw new Fehler(401, "XV-Nummer und Passwort passen nicht zusammen. Prüfe bitte Deine Eingabe.");
        }
        Fehlversuche.Remove(kennung);
        b["letzteAnmeldung"] = Jetzt();
        Speichern(daten, appData, false);
        AbgelaufeneEntfernen();
        string token = NeuesToken();
        Sitzungen[Schluessel(token)] = new Sitzung { Kennung = kennung, Ablauf = DateTime.UtcNow.Add(SitzungsDauer) };
        sitzungenGeaendert = true;
        var r = Antwort(200, Sicht(daten, b));
        r.Cookie = token;
        return r;
    }

    /// <summary>Die Anmeldung gilt fest 7 Tage ab dem Anmelden, sie verlängert sich nicht von selbst.</summary>
    private static Dictionary<string, object> Angemeldet(Dictionary<string, object> daten, string sitzung)
    {
        Sitzung s;
        if (sitzung == null || !Sitzungen.TryGetValue(sitzung, out s) || s.Ablauf < DateTime.UtcNow)
        {
            if (sitzung != null && Sitzungen.Remove(sitzung)) sitzungenGeaendert = true;
            throw new Fehler(401, "Deine Anmeldung ist abgelaufen. Melde Dich bitte neu an.");
        }
        var b = Benutzer(daten, s.Kennung);
        if (b == null) { Sitzungen.Remove(sitzung); sitzungenGeaendert = true; throw new Fehler(401, "Dein Konto gibt es nicht mehr. Wende Dich bitte an Deine Abteilungsleitung."); }
        return b;
    }

    /// <summary>Beendet alle Sitzungen eines Kontos, auf Wunsch bis auf die aktuelle.</summary>
    private static void SitzungenBeenden(string kennung, string ausser = null)
    {
        foreach (var t in Sitzungen.Where(x => x.Value.Kennung == kennung && x.Key != ausser).Select(x => x.Key).ToList()) { Sitzungen.Remove(t); sitzungenGeaendert = true; }
    }

    private static void AbgelaufeneEntfernen()
    {
        foreach (var t in Sitzungen.Where(x => x.Value.Ablauf < DateTime.UtcNow).Select(x => x.Key).ToList()) { Sitzungen.Remove(t); sitzungenGeaendert = true; }
    }

    private static string Schluessel(string token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 200) return null;
        using (var sha = SHA256.Create()) return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(token)));
    }

    /// <summary>Liest App_Data\sitzungen.json einmal pro Prozess, damit Anmeldungen einen Neustart überstehen.</summary>
    private static void SitzungenLaden(string appData)
    {
        if (sitzungenGeladen) return;
        sitzungenGeladen = true;
        string datei = Path.Combine(appData, "sitzungen.json");
        if (!File.Exists(datei)) return;
        try
        {
            foreach (var x in L(Serializer().DeserializeObject(File.ReadAllText(datei, Encoding.UTF8))))
            {
                var e = D(x);
                DateTime ablauf;
                string s = S(e, "s"), k = S(e, "k");
                if (string.IsNullOrEmpty(s) || !KennungMuster.IsMatch(k ?? "")) continue;
                if (!DateTime.TryParse(S(e, "a"), null, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out ablauf)) continue;
                if (ablauf > DateTime.UtcNow) Sitzungen[s] = new Sitzung { Kennung = k, Ablauf = ablauf };
            }
        }
        catch (Exception) { /* Defekte Datei: alle melden sich neu an */ }
    }

    private static void SitzungenSichern(string appData)
    {
        sitzungenGeaendert = false;
        var liste = Sitzungen.Select(x => new Dictionary<string, object> { { "s", x.Key }, { "k", x.Value.Kennung }, { "a", x.Value.Ablauf.ToString("o") } }).ToList();
        DateiSchreiben(Path.Combine(appData, "sitzungen.json"), Serializer().Serialize(liste));
    }

    private static BdErgebnis PasswortAendern(Dictionary<string, object> daten, Dictionary<string, object> ich, Dictionary<string, object> k, string appData, string sitzung)
    {
        string neu = S(k, "neu") ?? "";
        string alt = S(k, "alt");
        if (B(ich, "mussPasswortAendern"))
        {
            if (PasswortPasst(ich, neu)) throw new Fehler(400, "Wähle bitte ein anderes Passwort als Dein Einmalpasswort.");
        }
        else
        {
            if (alt == null || !PasswortPasst(ich, alt)) throw new Fehler(400, "Dein aktuelles Passwort stimmt nicht. Prüfe bitte Deine Eingabe.");
            if (alt == neu) throw new Fehler(400, "Wähle bitte ein anderes Passwort als Dein bisheriges.");
        }
        PasswortRegeln(neu, S(ich, "kennung"), S(ich, "vorname"), S(ich, "nachname"), "Dein Passwort");
        PasswortSetzen(ich, neu, false);
        SitzungenBeenden(S(ich, "kennung"), sitzung);
        Speichern(daten, appData, true);
        return Antwort(200, new { ok = true });
    }

    // ---------- Benutzer ----------

    private static bool DarfKontoVerwalten(Dictionary<string, object> ich, Dictionary<string, object> ziel)
    {
        string r = S(ich, "rolle");
        if (r == "admin") return true;
        return r == "al" && (ziel == null || S(ziel, "rolle") != "admin");
    }

    /// <summary>Gleiche Regeln wie pruefeBenutzer in js/daten.js</summary>
    private static void PruefeBenutzer(Dictionary<string, object> daten, Dictionary<string, object> ich, Dictionary<string, object> ziel, string kennung, string vorname, string nachname, string rolle)
    {
        if (ziel == null)
        {
            if (!KennungMuster.IsMatch(kennung)) throw new Fehler(400, "Die XV-Nummer besteht aus „xv“ und fünf Ziffern, zum Beispiel xv12345.");
            if (Benutzer(daten, kennung) != null) throw new Fehler(400, "Die XV-Nummer " + kennung + " gibt es schon.");
        }
        if (vorname == "" || nachname == "") throw new Fehler(400, "Gib bitte Vor- und Nachnamen ein.");
        if (vorname.Length > 40 || nachname.Length > 40) throw new Fehler(400, "Vor- und Nachname haben höchstens 40 Zeichen.");
        if (!Rollen.Contains(rolle)) throw new Fehler(400, "Wähle bitte eine Rolle.");
        if (!DarfKontoVerwalten(ich, ziel) || (rolle == "admin" && S(ich, "rolle") != "admin")) throw new Fehler(403, "Administratoren verwaltet nur ein Administrator.");
        if (ziel != null && S(ziel, "rolle") == "admin" && rolle != "admin")
        {
            if (S(ziel, "kennung") == S(ich, "kennung")) throw new Fehler(400, "Du kannst Dir die Rolle Administrator nicht selbst nehmen.");
            if (AnzahlAdmins(daten) <= 1) throw new Fehler(400, "Es muss mindestens ein Administrator bleiben.");
        }
    }

    private static int AnzahlAdmins(Dictionary<string, object> daten) { return L(daten["benutzer"]).Count(x => S(D(x), "rolle") == "admin"); }

    /// <summary>Kostenstellen für Abteilungs- und Gruppenleitung, Projektnummern für Key Account Manager</summary>
    private static bool PasstZurArt(Dictionary<string, object> b, string art)
    {
        string r = S(b, "rolle");
        return art == "ks" ? r == "al" || r == "gl" : art == "pn" && r == "kam";
    }

    /// <summary>Setzt die Zuweisungen eines Benutzers neu; Nummern, die nicht zur Rolle passen, fallen weg.</summary>
    private static void NummernSetzen(Dictionary<string, object> daten, Dictionary<string, object> b, Dictionary<string, object> nummern)
    {
        string kennung = S(b, "kennung");
        foreach (var art in new[] { "ks", "pn" })
        {
            var soll = new HashSet<string>(L(G(nummern, art)).Select(x => x as string).Where(x => x != null));
            foreach (var n in Liste(daten, art).Select(x => D(x)))
            {
                var liste = Kennungen(n).Where(x => x != kennung).ToList();
                if (PasstZurArt(b, art) && soll.Contains(S(n, "nummer"))) liste.Add(kennung);
                liste.Sort(string.CompareOrdinal);
                n["benutzer"] = liste.Cast<object>().ToList();
            }
        }
    }

    // ---------- Kostenstellen und Projektnummern ----------

    private static IList<object> Liste(Dictionary<string, object> daten, string art)
    {
        if (art == "ks") return (IList<object>)daten["kostenstellen"];
        if (art == "pn") return (IList<object>)daten["projekte"];
        throw new Fehler(400, "Unbekannte Art.");
    }

    private static string ArtName(string art) { return art == "pn" ? "Projektnummer" : "Kostenstelle"; }

    private static bool GueltigeNummer(string art, string nummer) { return Regex.IsMatch(nummer ?? "", art == "pn" ? "^[0-9]{8}$" : "^[0-9]{3}$"); }

    private static Dictionary<string, object> FindeNummer(Dictionary<string, object> daten, string art, string nummer)
    {
        return Liste(daten, art).Select(x => D(x)).FirstOrDefault(x => S(x, "nummer") == nummer);
    }

    private static List<string> Kennungen(Dictionary<string, object> n) { return L(G(n, "benutzer")).Select(x => x as string).Where(x => x != null).ToList(); }

    private static List<string> Unter(Dictionary<string, object> n) { return L(G(n, "unter")).Select(x => x as string).Where(x => x != null).ToList(); }

    /// <summary>Übergreifende Kostenstelle, zu der nummer gehört, sonst "" (gleich wie uebergeordnete in js/daten.js)</summary>
    private static string Uebergeordnete(Dictionary<string, object> daten, string nummer)
    {
        foreach (var n in Liste(daten, "ks").Select(x => D(x))) if (Unter(n).Contains(nummer)) return S(n, "nummer");
        return "";
    }

    /// <summary>Gleiche Regeln wie pruefeUnter in js/daten.js: nur eine Ebene, jede Kostenstelle gehört zu höchstens einer übergreifenden.</summary>
    private static void PruefeUnter(Dictionary<string, object> daten, string alt, string nummer, List<string> unter)
    {
        if (unter.Count == 0) return;
        string oben = alt != "" ? Uebergeordnete(daten, alt) : "";
        if (oben != "") throw new Fehler(400, "Die Kostenstelle " + (alt != "" ? alt : nummer) + " gehört schon zur übergreifenden Kostenstelle " + oben + " und kann deshalb keine Kostenstellen zusammenfassen.");
        foreach (var u in unter)
        {
            var e = FindeNummer(daten, "ks", u);
            if (u == nummer || u == alt) throw new Fehler(400, "Eine Kostenstelle kann sich nicht selbst zugeordnet werden.");
            if (e == null) throw new Fehler(400, "Die Kostenstelle " + u + " gibt es nicht.");
            if (Unter(e).Count > 0) throw new Fehler(400, "Die Kostenstelle " + u + " ist selbst übergreifend und kann nicht zugeordnet werden.");
            string andere = Uebergeordnete(daten, u);
            if (andere != "" && andere != alt) throw new Fehler(400, "Die Kostenstelle " + u + " gehört schon zur übergreifenden Kostenstelle " + andere + ".");
        }
    }

    /// <summary>Gleiche Regeln wie speichereNummer in js/daten.js. Eine geänderte Nummer nimmt ihre Planbudgets und Zuordnungen mit.</summary>
    private static void NummerSpeichern(Dictionary<string, object> daten, string art, string alt, string nummer, List<string> kennungen, List<string> unter, string ks)
    {
        var liste = Liste(daten, art);
        string name = ArtName(art);
        if (!GueltigeNummer(art, nummer)) throw new Fehler(400, "Eine " + name + " besteht aus genau " + (art == "pn" ? 8 : 3) + " Ziffern.");
        var eintrag = alt != "" ? FindeNummer(daten, art, alt) : null;
        if (alt != "" && eintrag == null) throw new Fehler(404, "Die " + name + " " + alt + " gibt es nicht mehr.");
        if (nummer != alt && FindeNummer(daten, art, nummer) != null) throw new Fehler(400, "Die " + name + " " + nummer + " gibt es schon.");
        List<string> neuUnter = null;
        if (art == "ks" && unter != null)
        {
            neuUnter = unter.Select(u => u.Trim()).Where(u => u != "").Distinct().ToList();
            neuUnter.Sort(string.CompareOrdinal);
            PruefeUnter(daten, alt, nummer, neuUnter);
        }
        string neuKs = null;
        if (art == "pn" && ks != null)
        {
            neuKs = ks.Trim();
            if (neuKs != "" && FindeNummer(daten, "ks", neuKs) == null) throw new Fehler(400, "Die Kostenstelle " + neuKs + " gibt es nicht.");
        }
        var zugewiesen = new List<string>();
        foreach (var k in kennungen)
        {
            var b = Benutzer(daten, k);
            if (b != null && PasstZurArt(b, art) && !zugewiesen.Contains(S(b, "kennung"))) zugewiesen.Add(S(b, "kennung"));
        }
        zugewiesen.Sort(string.CompareOrdinal);
        if (eintrag == null)
        {
            eintrag = new Dictionary<string, object>();
            if (art == "ks") eintrag["unter"] = new List<object>(); else eintrag["ks"] = "";
            liste.Add(eintrag);
        }
        if (alt != "" && nummer != alt)
        {
            foreach (var j in D(daten["budgets"]).Values.Select(x => D(x)))
                if (j.ContainsKey(art + "-" + alt)) { j[art + "-" + nummer] = j[art + "-" + alt]; j.Remove(art + "-" + alt); }
            if (art == "ks")
                foreach (var n in liste.Select(x => D(x)))
                {
                    var u = Unter(n);
                    if (!u.Contains(alt)) continue;
                    u = u.Select(x => x == alt ? nummer : x).ToList();
                    u.Sort(string.CompareOrdinal);
                    n["unter"] = u.Cast<object>().ToList();
                }
            if (art == "ks")
            {
                var ist = D(daten["ist"]);
                if (ist.ContainsKey("ks-" + alt)) { ist["ks-" + nummer] = ist["ks-" + alt]; ist.Remove("ks-" + alt); }
                foreach (var x in L(daten["istSicherungen"]).Select(y => D(y))) if (S(x, "nummer") == alt) x["nummer"] = nummer;
                foreach (var p in L(daten["projekte"]).Select(y => D(y))) if (S(p, "ks") == alt) p["ks"] = nummer;
            }
            else foreach (var x in L(daten["kosten"]).Select(y => D(y))) if (S(x, "pn") == alt) x["pn"] = nummer;
        }
        eintrag["nummer"] = nummer;
        eintrag["benutzer"] = zugewiesen.Cast<object>().ToList();
        if (neuUnter != null) eintrag["unter"] = neuUnter.Cast<object>().ToList();
        if (neuKs != null) eintrag["ks"] = neuKs;
        else if (art == "ks" && !eintrag.ContainsKey("unter")) eintrag["unter"] = new List<object>();
        var sortiert = liste.OrderBy(x => S(D(x), "nummer"), StringComparer.Ordinal).ToList();
        liste.Clear();
        foreach (var x in sortiert) liste.Add(x);
    }

    // ---------- Planbudgets ----------

    /// <summary>Liest einen Betrag wie 1.234,56 oder 1234.5 (oder eine Zahl); leer = 0; ungültig = null. Gleich wie leseBetrag in js/daten.js.</summary>
    public static decimal? LeseBetrag(object wert)
    {
        if (wert == null) return 0m;
        if (wert is int || wert is long || wert is decimal || wert is double)
        {
            decimal z;
            try { z = Convert.ToDecimal(wert, CultureInfo.InvariantCulture); } catch { return null; }
            if (z < 0 || z > MaxBetrag) return null;
            return Math.Round(z, 2, MidpointRounding.AwayFromZero);
        }
        string t = Regex.Replace(Convert.ToString(wert, CultureInfo.InvariantCulture), "\\s|€|EUR", "", RegexOptions.IgnoreCase);
        if (t == "") return 0m;
        if (Regex.IsMatch(t, "^[0-9]{1,3}(\\.[0-9]{3})+(,[0-9]{1,2})?$") || Regex.IsMatch(t, "^[0-9]+(,[0-9]{1,2})?$")) t = t.Replace(".", "").Replace(",", ".");
        else if (!Regex.IsMatch(t, "^[0-9]+(\\.[0-9]{1,2})?$")) return null;
        decimal d;
        if (!decimal.TryParse(t, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out d) || d > MaxBetrag) return null;
        return Math.Round(d, 2, MidpointRounding.AwayFromZero);
    }

    private static readonly Dictionary<string, string> PositionsNamen = new Dictionary<string, string> {
        { "pkId", "Personalkosten ID" }, { "pkAd", "Personalkosten AD" }, { "werbung", "Werbung" }, { "reise", "Reise/KfZ" }, { "sonstiges", "Sonstiges" } };

    private static void BudgetSetzen(Dictionary<string, object> daten, string jahr, string art, string nummer, Dictionary<string, object> werte)
    {
        if (!JahrMuster.IsMatch(jahr)) throw new Fehler(400, "Wähle bitte ein Kalenderjahr.");
        if (art != "ks" && art != "pn") throw new Fehler(400, "Unbekannte Art.");
        if (FindeNummer(daten, art, nummer) == null) throw new Fehler(404, "Die " + ArtName(art) + " " + nummer + " gibt es nicht mehr.");
        var neu = new Dictionary<string, object>();
        foreach (var p in Positionen)
        {
            var z = LeseBetrag(G(werte, p));
            if (z == null) throw new Fehler(400, "Prüfe bitte den Betrag bei „" + PositionsNamen[p] + "“. Erlaubt sind Beträge ab 0 €, zum Beispiel 12.500,00.");
            neu[p] = z.Value;
        }
        var budgets = D(daten["budgets"]);
        if (!budgets.ContainsKey(jahr)) budgets[jahr] = new Dictionary<string, object>();
        D(budgets[jahr])[art + "-" + nummer] = neu;
    }

    // ---------- IST-Daten (gleiche Regeln wie setzeIst und stelleIstWiederHer in js/daten.js) ----------

    private const int MaxSicherungen = 30;

    /// <summary>Prüft einen Teil {jahr, werte}; null bleibt null, ungültig wirft.</summary>
    private static Dictionary<string, object> IstTeil(object o)
    {
        if (o == null) return null;
        var t = o as Dictionary<string, object>;
        var w = t == null ? null : G(t, "werte") as Dictionary<string, object>;
        string jahr = t == null ? "" : Convert.ToString(G(t, "jahr"), CultureInfo.InvariantCulture);
        if (w == null || !JahrMuster.IsMatch(jahr ?? "")) throw new Fehler(400, "Die IST-Werte sind unvollständig.");
        var werte = new Dictionary<string, object>();
        foreach (var p in Positionen)
        {
            object z = G(w, p);
            decimal d;
            if (!(z is int || z is long || z is decimal || z is double)) throw new Fehler(400, "Die IST-Werte sind unvollständig.");
            try { d = Convert.ToDecimal(z, CultureInfo.InvariantCulture); } catch { throw new Fehler(400, "Die IST-Werte sind unvollständig."); }
            if (Math.Abs(d) > MaxBetrag) throw new Fehler(400, "Die IST-Werte sind unvollständig.");
            werte[p] = Math.Round(d, 2, MidpointRounding.AwayFromZero);
        }
        return new Dictionary<string, object> { { "jahr", int.Parse(jahr, CultureInfo.InvariantCulture) }, { "werte", werte } };
    }

    private static void IstSichern(Dictionary<string, object> daten, string nummer, string kennung, string anlass)
    {
        var ist = D(daten["ist"]);
        var liste = L(daten["istSicherungen"]).ToList();
        liste.Insert(0, new Dictionary<string, object> {
            { "id", "s" + Guid.NewGuid().ToString("N").Substring(0, 12) }, { "zeit", Jetzt() }, { "von", kennung ?? "" },
            { "nummer", nummer }, { "anlass", anlass }, { "vorher", ist.ContainsKey("ks-" + nummer) ? ist["ks-" + nummer] : null } });
        daten["istSicherungen"] = liste.Take(MaxSicherungen).ToList();
    }

    private static void IstSetzen(Dictionary<string, object> daten, string nummer, Dictionary<string, object> e, string kennung)
    {
        if (FindeNummer(daten, "ks", nummer) == null) throw new Fehler(404, "Die Kostenstelle " + nummer + " gibt es nicht.");
        if (e == null) throw new Fehler(400, "Die IST-Werte sind unvollständig.");
        string stand = S(e, "stand") ?? "", monat = S(e, "monat") ?? "";
        if (!Regex.IsMatch(stand, "^[0-9]{4}-[0-9]{2}-[0-9]{2}$") || !Regex.IsMatch(monat, "^[0-9]{4}-(0[1-9]|1[0-2])$")) throw new Fehler(400, "Datenstand oder Abrechnungsmonat fehlen.");
        var akt = IstTeil(G(e, "aktuell"));
        if (akt == null) throw new Fehler(400, "Die IST-Werte sind unvollständig.");
        var vz = IstTeil(G(e, "vorjahrZeitraum"));
        var vj = IstTeil(G(e, "vorjahr"));
        if (monat.Substring(0, 4) != Convert.ToString(akt["jahr"], CultureInfo.InvariantCulture)) throw new Fehler(400, "Abrechnungsmonat und IST-Jahr passen nicht zusammen.");
        IstSichern(daten, nummer, kennung, "Import");
        D(daten["ist"])["ks-" + nummer] = new Dictionary<string, object> {
            { "stand", stand }, { "monat", monat }, { "aktuell", akt }, { "vorjahrZeitraum", vz }, { "vorjahr", vj },
            { "datei", Kuerzen(S(e, "datei"), 120) }, { "importiert", Jetzt() }, { "von", kennung ?? "" } };
    }

    private static void IstWiederherstellen(Dictionary<string, object> daten, string id, string kennung)
    {
        var s = L(daten["istSicherungen"]).Select(x => D(x)).FirstOrDefault(x => S(x, "id") == id);
        if (s == null) throw new Fehler(404, "Diese Sicherung gibt es nicht mehr.");
        string nummer = S(s, "nummer");
        if (FindeNummer(daten, "ks", nummer) == null) throw new Fehler(404, "Die Kostenstelle " + nummer + " gibt es nicht mehr.");
        var vorher = G(s, "vorher");
        IstSichern(daten, nummer, kennung, "Wiederherstellung");
        var ist = D(daten["ist"]);
        if (vorher != null) ist["ks-" + nummer] = Serializer().DeserializeObject(Serializer().Serialize(vorher));
        else ist.Remove("ks-" + nummer);
    }

    // ---------- Projektkosten (gleiche Regeln wie speichereKosten in js/daten.js) ----------

    private static void KostenSpeichern(Dictionary<string, object> daten, string id, Dictionary<string, object> f, string kennung)
    {
        string pn = S(f, "pn") ?? "", datum = S(f, "datum") ?? "", art = S(f, "kostenart") ?? "", text = (S(f, "text") ?? "").Trim();
        if (FindeNummer(daten, "pn", pn) == null) throw new Fehler(404, "Die Projektnummer " + pn + " gibt es nicht.");
        DateTime d;
        if (!Regex.IsMatch(datum, "^20[0-9]{2}-[0-9]{2}-[0-9]{2}$") || !DateTime.TryParseExact(datum, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d))
            throw new Fehler(400, "Gib bitte ein gültiges Datum ein.");
        if (!Positionen.Contains(art)) throw new Fehler(400, "Wähle bitte die Kostenart.");
        var betrag = LeseBetrag(G(f, "betrag"));
        if (betrag == null || betrag.Value == 0m) throw new Fehler(400, "Gib bitte einen Betrag größer als 0 € ein, zum Beispiel 1.250,00.");
        if (text.Length > 120) throw new Fehler(400, "Die Beschreibung hat höchstens 120 Zeichen.");
        var liste = L(daten["kosten"]).ToList();
        Dictionary<string, object> e = null;
        if (id != "")
        {
            e = liste.Select(x => D(x)).FirstOrDefault(x => S(x, "id") == id);
            if (e == null) throw new Fehler(404, "Diesen Eintrag gibt es nicht mehr.");
        }
        else
        {
            e = new Dictionary<string, object> { { "id", "k" + Guid.NewGuid().ToString("N").Substring(0, 12) }, { "erfasst", Jetzt() }, { "von", kennung ?? "" } };
            liste.Add(e);
        }
        e["pn"] = pn; e["datum"] = datum; e["kostenart"] = art; e["betrag"] = betrag.Value; e["text"] = text;
        e["geaendert"] = Jetzt(); e["geaendertVon"] = kennung ?? "";
        daten["kosten"] = liste.OrderByDescending(x => S(D(x), "datum"), StringComparer.Ordinal).ToList();
    }

    // ---------- Sicht für die Oberfläche (gleiche Regeln wie sicht() in js/daten.js) ----------

    private static object Sicht(Dictionary<string, object> daten, Dictionary<string, object> ich)
    {
        string rolle = S(ich, "rolle"), kennung = S(ich, "kennung");
        bool verwaltet = rolle == "admin" || rolle == "al";
        var d = new Dictionary<string, object>();
        foreach (var s in new[] { "schema", "stand", "einstellungen", "geaendert" }) if (daten.ContainsKey(s)) d[s] = daten[s];
        var benutzer = new List<object>();
        foreach (var x in L(daten["benutzer"]))
        {
            var b = D(x);
            if (!verwaltet && S(b, "kennung") != kennung) continue;
            var kopie = new Dictionary<string, object>();
            foreach (var p in b) if (p.Key != "hash" && p.Key != "salz") kopie[p.Key] = p.Value;
            if (!verwaltet) kopie["einmalpasswort"] = "";
            benutzer.Add(kopie);
        }
        d["benutzer"] = benutzer;
        var erlaubt = new HashSet<string>();
        foreach (var art in new[] { "ks", "pn" })
        {
            var liste = new List<object>();
            foreach (var n in Liste(daten, art).Select(x => D(x)))
            {
                var k = Kennungen(n);
                if (!verwaltet && !k.Contains(kennung)) continue;
                var kopie = new Dictionary<string, object> { { "nummer", S(n, "nummer") }, { "benutzer", verwaltet ? k : new List<string> { kennung } } };
                if (art == "ks") kopie["unter"] = Unter(n);
                else kopie["ks"] = S(n, "ks");
                liste.Add(kopie);
                erlaubt.Add(art + "-" + S(n, "nummer"));
            }
            // Zu eigenen übergreifenden Kostenstellen kommen die zugeordneten dazu (ohne Zuweisung), damit die Summe stimmt
            if (art == "ks" && !verwaltet)
            {
                var da = new HashSet<string>(liste.Select(x => S(D(x), "nummer")));
                foreach (var x in liste.ToList())
                    foreach (var u in (List<string>)D(x)["unter"])
                        if (!da.Contains(u) && FindeNummer(daten, "ks", u) != null)
                        {
                            da.Add(u);
                            liste.Add(new Dictionary<string, object> { { "nummer", u }, { "benutzer", new List<string>() }, { "unter", new List<string>() } });
                            erlaubt.Add("ks-" + u);
                        }
                liste = liste.OrderBy(x => S(D(x), "nummer"), StringComparer.Ordinal).ToList();
            }
            // Projektnummern, deren Kosten von sichtbaren Kostenstellen abgehen, kommen ohne Zuweisung dazu
            if (art == "pn" && !verwaltet)
            {
                var ksDa = new HashSet<string>(L(d["kostenstellen"]).Select(x => S(D(x), "nummer")));
                var da = new HashSet<string>(liste.Select(x => S(D(x), "nummer")));
                foreach (var n in L(daten["projekte"]).Select(x => D(x)))
                {
                    string ks = S(n, "ks"), nr = S(n, "nummer");
                    if (ks == "" || !ksDa.Contains(ks) || da.Contains(nr)) continue;
                    da.Add(nr);
                    liste.Add(new Dictionary<string, object> { { "nummer", nr }, { "benutzer", new List<string>() }, { "ks", ks } });
                    erlaubt.Add("pn-" + nr);
                }
                liste = liste.OrderBy(x => S(D(x), "nummer"), StringComparer.Ordinal).ToList();
            }
            d[art == "ks" ? "kostenstellen" : "projekte"] = liste;
        }
        // Projektkosten: Administrator keine, Abteilungsleitung alle, sonst die der sichtbaren Projektnummern
        var kosten = new List<object>();
        if (rolle != "admin")
            foreach (var x in L(daten["kosten"])) if (rolle == "al" || erlaubt.Contains("pn-" + S(D(x), "pn"))) kosten.Add(x);
        d["kosten"] = kosten;
        var budgets = new Dictionary<string, object>();
        if (rolle != "admin")
        {
            foreach (var j in D(daten["budgets"]))
            {
                var teil = new Dictionary<string, object>();
                foreach (var e in D(j.Value)) if (rolle == "al" || erlaubt.Contains(e.Key)) teil[e.Key] = e.Value;
                if (teil.Count > 0) budgets[j.Key] = teil;
            }
        }
        d["budgets"] = budgets;
        // IST wie Planbudgets; Sicherungen nur als Liste ohne Werte für Abteilungsleitung und Administrator
        var ist = new Dictionary<string, object>();
        if (rolle != "admin")
            foreach (var e in D(daten["ist"])) if (rolle == "al" || erlaubt.Contains(e.Key)) ist[e.Key] = e.Value;
        d["ist"] = ist;
        var sicherungen = new List<object>();
        if (verwaltet)
            foreach (var x in L(daten["istSicherungen"]).Select(y => D(y)))
            {
                var v = G(x, "vorher") as Dictionary<string, object>;
                sicherungen.Add(new Dictionary<string, object> {
                    { "id", S(x, "id") }, { "zeit", S(x, "zeit") }, { "von", S(x, "von") }, { "nummer", S(x, "nummer") }, { "anlass", S(x, "anlass") },
                    { "vorherStand", v == null ? "" : S(v, "stand") }, { "vorherMonat", v == null ? "" : S(v, "monat") } });
            }
        d["istSicherungen"] = sicherungen;
        return new { ich = kennung, daten = d };
    }

    // ---------- Daten laden und speichern ----------

    private static Dictionary<string, object> Laden(string appData)
    {
        string datei = Path.Combine(appData, "daten.json");
        if (!File.Exists(datei))
        {
            var neu = new Dictionary<string, object> {
                { "schema", 1 }, { "stand", 0 },
                { "einstellungen", new Dictionary<string, object> { { "titel", StandardTitel } } },
                { "benutzer", new List<object>() }, { "kostenstellen", new List<object>() }, { "projekte", new List<object>() },
                { "budgets", new Dictionary<string, object>() }, { "ist", new Dictionary<string, object>() }, { "istSicherungen", new List<object>() }, { "kosten", new List<object>() } };
            var admin = NeuerBenutzer(StandardAdmin, "Admin", "Budget", "admin");
            PasswortSetzen(admin, StandardPasswort, false);
            L(neu["benutzer"]).Add(admin);
            Speichern(neu, appData, false);
            return neu;
        }
        var daten = D(Serializer().DeserializeObject(File.ReadAllText(datei, Encoding.UTF8)));
        // Listen veränderbar machen (der Serializer liefert Arrays)
        foreach (var s in new[] { "benutzer", "kostenstellen", "projekte" }) daten[s] = L(daten.ContainsKey(s) ? daten[s] : null).ToList();
        if (!(G(daten, "budgets") is Dictionary<string, object>)) daten["budgets"] = new Dictionary<string, object>();
        if (!(G(daten, "ist") is Dictionary<string, object>)) daten["ist"] = new Dictionary<string, object>();
        daten["istSicherungen"] = L(G(daten, "istSicherungen")).ToList();
        daten["kosten"] = L(G(daten, "kosten")).ToList();
        foreach (var p in L(daten["projekte"]).Select(x => D(x))) if (!(G(p, "ks") is string)) p["ks"] = "";
        if (!(G(daten, "einstellungen") is Dictionary<string, object>)) daten["einstellungen"] = new Dictionary<string, object> { { "titel", StandardTitel } };
        if (!daten.ContainsKey("stand")) daten["stand"] = 0;
        return daten;
    }

    private static void Speichern(Dictionary<string, object> daten, string appData, bool sichern)
    {
        string datei = Path.Combine(appData, "daten.json");
        daten["geaendert"] = Jetzt();
        if (sichern && File.Exists(datei))
        {
            string ordner = Path.Combine(appData, "sicherungen");
            Directory.CreateDirectory(ordner);
            File.Copy(datei, Path.Combine(ordner, "daten-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + ".json"), true);
            foreach (var alt in Directory.GetFiles(ordner, "daten-*.json").OrderByDescending(x => x).Skip(AnzahlSicherungen)) File.Delete(alt);
        }
        DateiSchreiben(datei, Serializer().Serialize(daten));
    }

    private static void DateiSchreiben(string datei, string inhalt)
    {
        string tmp = datei + ".tmp";
        File.WriteAllText(tmp, inhalt, new UTF8Encoding(false));
        if (File.Exists(datei)) File.Replace(tmp, datei, null);
        else File.Move(tmp, datei);
    }

    // ---------- Passwörter ----------

    /// <summary>Gleiche Regeln wie passwortMaengel in js/daten.js</summary>
    private static void PasswortRegeln(string pw, string kennung, string vorname, string nachname, string wer)
    {
        var fehlt = new List<string>();
        if (pw.Length < 12) fehlt.Add("mindestens 12 Zeichen");
        if (!Regex.IsMatch(pw, "[a-zäöüß]")) fehlt.Add("einen Kleinbuchstaben");
        if (!Regex.IsMatch(pw, "[A-ZÄÖÜ]")) fehlt.Add("einen Großbuchstaben");
        if (!Regex.IsMatch(pw, "[0-9]")) fehlt.Add("eine Ziffer");
        if (!Regex.IsMatch(pw, "[^A-Za-z0-9äöüÄÖÜß]")) fehlt.Add("ein Sonderzeichen");
        string klein = pw.ToLowerInvariant();
        if (new[] { kennung, vorname, nachname }.Select(t => (t ?? "").Trim().ToLowerInvariant()).Any(t => t.Length >= 3 && klein.Contains(t))) fehlt.Add("nicht Deine XV-Nummer oder Deinen Namen");
        if (Gaengig.Any(g => klein.Contains(g))) fehlt.Add("keine gängigen Wörter oder Zahlenfolgen");
        if (Regex.IsMatch(pw, "(.)\\1\\1\\1")) fehlt.Add("kein Zeichen viermal hintereinander");
        if (pw.Length > 200) fehlt.Add("höchstens 200 Zeichen");
        if (fehlt.Count > 0) throw new Fehler(400, wer + " braucht noch " + string.Join(", ", fehlt) + ".");
    }

    /// <summary>PBKDF2-SHA256, 100.000 Runden, Salz als UTF-8 des Hex-Texts: gleich wie js/daten.js.</summary>
    public static string Hash(string passwort, string salz)
    {
        using (var kdf = new Rfc2898DeriveBytes(Encoding.UTF8.GetBytes(passwort), Encoding.UTF8.GetBytes(salz), Iterationen, HashAlgorithmName.SHA256))
            return Hex(kdf.GetBytes(32));
    }

    private static bool PasswortPasst(Dictionary<string, object> b, string passwort)
    {
        string salz = S(b, "salz"), soll = S(b, "hash");
        if (string.IsNullOrEmpty(salz) || string.IsNullOrEmpty(soll)) return false;
        string ist = Hash(passwort ?? "", salz);
        if (ist.Length != soll.Length) return false;
        int diff = 0;
        for (int i = 0; i < ist.Length; i++) diff |= ist[i] ^ soll[i];
        return diff == 0;
    }

    /// <summary>einmal: Einmalpasswort, bleibt bis zur ersten Anmeldung in der Benutzerverwaltung sichtbar.</summary>
    private static void PasswortSetzen(Dictionary<string, object> b, string passwort, bool einmal)
    {
        var bytes = new byte[16];
        using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        string salz = Hex(bytes);
        b["salz"] = salz;
        b["hash"] = Hash(passwort, salz);
        b["mussPasswortAendern"] = einmal;
        b["einmalpasswort"] = einmal ? passwort : "";
        b["passwortGeaendert"] = Jetzt();
    }

    private static string NeuesToken()
    {
        var bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        return Hex(bytes);
    }

    // ---------- Hilfen ----------

    private static Dictionary<string, object> NeuerBenutzer(string kennung, string vorname, string nachname, string rolle)
    {
        return new Dictionary<string, object> {
            { "kennung", kennung }, { "vorname", vorname ?? "" }, { "nachname", nachname ?? "" }, { "rolle", rolle },
            { "salz", "" }, { "hash", "" }, { "einmalpasswort", "" }, { "mussPasswortAendern", true },
            { "design", "auto" }, { "farbe", "klassik" }, { "erstellt", Jetzt() }, { "letzteAnmeldung", "" } };
    }

    private static Dictionary<string, object> Benutzer(Dictionary<string, object> daten, string kennung)
    {
        string k = (kennung ?? "").Trim().ToLowerInvariant();
        foreach (var x in L(daten["benutzer"])) { var b = D(x); if (S(b, "kennung") == k) return b; }
        return null;
    }

    private static Dictionary<string, object> BenutzerPflicht(Dictionary<string, object> daten, string kennung)
    {
        var b = Benutzer(daten, kennung);
        if (b == null) throw new Fehler(404, "Diesen Benutzer gibt es nicht mehr.");
        return b;
    }

    private static object G(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) ? v : null; }

    private static string Kuerzen(string text, int max)
    {
        string t = (text ?? "").Trim();
        return t.Length > max ? t.Substring(0, max) : t;
    }

    private static string Hex(byte[] bytes) { return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant(); }
    private static string Jetzt() { return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); }

    private static JavaScriptSerializer Serializer() { return new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 100 }; }

    private static Dictionary<string, object> Json(string text)
    {
        try { var d = Serializer().DeserializeObject(text ?? "") as Dictionary<string, object>; if (d != null) return d; }
        catch { }
        throw new Fehler(400, "Die Anfrage ist ungültig.");
    }

    private static BdErgebnis Antwort(int status, object inhalt) { return new BdErgebnis(status, Serializer().Serialize(inhalt)); }

    private static Dictionary<string, object> D(object o)
    {
        var d = o as Dictionary<string, object>;
        if (d == null) throw new Fehler(400, "Die Anfrage ist ungültig.");
        return d;
    }

    private static IList<object> L(object o)
    {
        var l = o as List<object>;
        if (l != null) return l;
        var arr = o as object[];
        if (arr != null) return arr.ToList();
        var al = o as ArrayList;
        if (al != null) return al.Cast<object>().ToList();
        return new List<object>();
    }

    private static string S(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : null; }
    private static bool B(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v is bool && (bool)v; }
    private static int I(Dictionary<string, object> d, string k) { object v; if (d == null || !d.TryGetValue(k, out v) || v == null) return 0; try { return Convert.ToInt32(v); } catch { return 0; } }
}
