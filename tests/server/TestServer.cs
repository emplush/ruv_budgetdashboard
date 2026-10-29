// Testserver für Linux/Mono: liefert app/ aus und leitet api.ashx an BdKern weiter.
// Ersetzt den IIS nur für Tests. Aufruf über tests/server/server-test.sh
using System;
using System.IO;
using System.Net;
using System.Text;

public static class TestServer
{
    public static void Main(string[] args)
    {
        string wurzel = Path.GetFullPath(args[0]);
        string port = args.Length > 1 ? args[1] : "8098";
        var listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:" + port + "/");
        listener.Start();
        Console.WriteLine("Testserver läuft auf Port " + port);
        while (true)
        {
            var ctx = listener.GetContext();
            try { Bearbeiten(ctx, wurzel); }
            catch (Exception ex) { Console.WriteLine(ex); try { ctx.Response.StatusCode = 500; ctx.Response.Close(); } catch { } }
        }
    }

    static void Bearbeiten(HttpListenerContext ctx, string wurzel)
    {
        string pfad = Uri.UnescapeDataString(ctx.Request.Url.AbsolutePath).TrimStart('/');
        if (pfad == "") pfad = "index.html";
        if (pfad == "api.ashx")
        {
            string koerper = new StreamReader(ctx.Request.InputStream, Encoding.UTF8).ReadToEnd();
            var cookie = ctx.Request.Cookies[BdKern.CookieName];
            var e = BdKern.Verarbeiten(new BdAnfrage
            {
                Methode = ctx.Request.HttpMethod,
                Aktion = ctx.Request.QueryString["aktion"],
                Kopf = ctx.Request.Headers["X-Budgetdashboard"],
                Koerper = koerper,
                Laenge = ctx.Request.ContentLength64,
                Token = cookie != null ? cookie.Value : "",
                AppData = Path.Combine(wurzel, "App_Data")
            });
            if (e.Cookie != null) ctx.Response.AddHeader("Set-Cookie", BdKern.CookieKopf(e.Cookie, "/", false));
            Senden(ctx, e.Status, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(e.Json));
            return;
        }
        // App_Data und Quelltext des Handlers sind wie auf dem IIS gesperrt
        if (pfad.StartsWith("App_Data", StringComparison.OrdinalIgnoreCase) || pfad.Contains("..")) { Senden(ctx, 404, "text/plain", new byte[0]); return; }
        string datei = Path.Combine(wurzel, pfad);
        if (!File.Exists(datei)) { Senden(ctx, 404, "text/plain", new byte[0]); return; }
        string ext = Path.GetExtension(datei).ToLowerInvariant();
        string typ = ext == ".html" ? "text/html; charset=utf-8" : ext == ".css" ? "text/css" : ext == ".js" ? "application/javascript" :
            ext == ".svg" ? "image/svg+xml" : ext == ".png" ? "image/png" : ext == ".woff2" ? "font/woff2" : ext == ".woff" ? "font/woff" : "application/octet-stream";
        // Gleiche Content-Security-Policy wie in web.config, damit der Browsertest Verstöße findet
        if (ext == ".html") ctx.Response.AddHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
        Senden(ctx, 200, typ, File.ReadAllBytes(datei));
    }

    static void Senden(HttpListenerContext ctx, int status, string typ, byte[] daten)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = typ;
        ctx.Response.ContentLength64 = daten.Length;
        ctx.Response.OutputStream.Write(daten, 0, daten.Length);
        ctx.Response.Close();
    }
}
