# 🚉 Neste avgang

> **Interaktivitet med serveren som fasit.** En workshop om htmx, der serveren sender ferdig HTML
> i stedet for JSON. Bygget som en direkte oppfølger til «Rutine».

---

## 🎯 Hva handler dette om?

I forrige workshop bygde vi en todo-app med moderne HTML og CSS, uten JavaScript i nettleseren.
Appen virket, men hver handling lastet hele siden på nytt. To åpne faner visste ingenting om
hverandre, og checkboxen kunne vise en status serveren aldri hadde lagret.

Denne gangen starter vi med en helt vanlig app der serveren lager HTML-en, og forbedrer den med
[htmx](https://htmx.org/): serveren fortsetter å ha fasiten og returnerer HTML, men
nettleseren bytter bare delen av siden som faktisk har endret seg.

> **Kort fortalt:** htmx er et lite JavaScript-bibliotek som lar vanlige HTML-elementer sende
> HTTP-forespørsler og bytte ut deler av siden. Du beskriver hva som skal skje med attributter
> som `hx-get` og `hx-target`, og serveren svarer med ferdig HTML.

📖 [htmx: introduksjon og dokumentasjon](https://htmx.org/docs/) ·
[htmx: komplett referanse](https://htmx.org/reference/)

### EJS er ikke htmx

De står i de samme filene, men gjør jobben sin på hver sin side av HTTP-forbindelsen:

1. **På serveren:** Express gir data til EJS. EJS lager HTML og sender den som svar.
2. **I nettleseren:** htmx leser `hx-*`-attributtene i HTML-en. Når noe skjer, ber htmx
   serveren om mer HTML og bytter den inn på siden.

For eksempel kan servermalen inneholde:

```ejs
<a href="/avganger/<%= departure.id %>" hx-get="/avganger/<%= departure.id %>">Endre</a>
```

Hvis `departure.id` er `R10`, er dette det nettleseren og htmx mottar:

```html
<a href="/avganger/R10" hx-get="/avganger/R10">Endre</a>
```

`<%= departure.id %>` er EJS og forsvinner på serveren. `hx-get` er htmx og blir igjen i
HTML-en. En nyttig feilsøkingsregel er derfor: Er HTML-svaret feil i Network-panelet, se på
serveren og EJS. Er svaret riktig, men byttes ikke inn riktig sted, se på htmx-attributtene.

**Spørsmålet vi skal svare på:** hvor nær en moderne, interaktiv app kommer vi når serveren
sender HTML i stedet for JSON?

Vi bruker en avgangstavle fra Oslo S. Du er trafikkstyrer: du kan søke, registrere forsinkelser
og innstille avganger. Til slutt åpner vi tavlen i to faner og lar serveren holde dem i takt.

> 🚫 **Én regel:** ingen egen JavaScript-kode i nettleseren. Vi bruker htmx og utvidelsen for
> server-sent events, men skriver ikke egen kode som henter eller lagrer data i nettleseren.

---

## 🚀 Kom i gang

Du trenger Node.js 22 eller nyere.

```bash
git clone https://github.com/sveinpg/entur-faggruppe-moderne-web-htmx.git
cd entur-faggruppe-moderne-web-htmx
npm install
npm start
```

👉 Appen kjører på **<http://localhost:3000>**

Åpne også Network-panelet i DevTools. I denne workshopen er svaret fra serveren minst like
viktig som koden som sendte forespørselen.

Du kommer hovedsakelig til å jobbe i:

- `views/index.ejs`
- `views/partials/departure-row.ejs`
- `views/partials/departure-update.ejs`
- `public/index.css`

Serveren i `app.js` støtter allerede både hele sider og avgrensede deler av HTML-en. Les gjerne
rutene, men Express og EJS er infrastruktur, ikke hovedtema. I `.ejs`-filene betyr `<%= ... %>`
at EJS setter inn en verdi på serveren, mens `<%- include(...) %>` setter inn en annen servermal.
Oppgavene handler om `hx-*`-attributtene som er igjen i HTML-en nettleseren mottar.

### Serveren er klar

Alle endepunktene er ferdig laget. Du skal ikke opprette eller endre ruter i `app.js` i
hovedløypa. Jobben din er å koble HTML-elementene til endepunktene med `hx-*`-attributter og å
gjøre de små endringene i servermalene som oppgavene beskriver. Eksisterende `href`- og
`action`-verdier viser hvilke URL-er elementene allerede bruker uten htmx.

| Metode | Endepunkt | Svar fra serveren |
| --- | --- | --- |
| `GET` | `/` | Hele siden |
| `GET` | `/avganger?q=...` | Hele siden eller avgangstavlen |
| `GET` | `/avganger/:id/rediger` | En redigerbar avgangsrad |
| `GET` | `/avganger/:id` | En vanlig avgangsrad |
| `POST` | `/avganger/:id/forsinkelse` | Oppdatert rad og sammendrag |
| `POST` | `/avganger/:id/innstill` | Innstilt rad og sammendrag |
| `POST` | `/avganger/:id/sett-opp` | Gjenopprettet rad og sammendrag |
| `GET` | `/hendelser?q=...` | SSE-strøm med oppdatert tavle og sammendrag |

Ved en vanlig navigasjon returnerer serveren en hel side eller sender nettleseren videre. Når
htmx sender `HX-Request`, returnerer de samme rutene bare HTML-delen som skal byttes inn. `:id`
er plassholderen for id-en til avgangen, for eksempel `R10`.

---

## 🛤️ Ruta

| | Holdeplass | Tema |
| --- | --- | --- |
| 1 | [Søk uten sidelasting](#holdeplass-1-søk-uten-sidelasting) | `hx-get`, hendelse, mål og utskifting |
| 2 | [Åpne redigering på stedet](#holdeplass-2-åpne-redigering-på-stedet) | relativt mål med `closest` |
| 3 | [Lagre en liten del av siden](#holdeplass-3-lagre-en-liten-del-av-siden) | `hx-post` og POST uten videresending |
| 4 | [Innstill med bekreftelse](#holdeplass-4-innstill-med-bekreftelse) | bekreftelse og radbytte |
| 5 | [Oppdater flere steder samtidig](#holdeplass-5-oppdater-flere-steder-samtidig) | `hx-swap-oob` |
| 6 | [La feilsvar bli brukergrensesnitt](#holdeplass-6-la-feilsvar-bli-brukergrensesnitt) | HTTP 422 og regler for svar |
| 7 | [Tregt nett og raske fingre](#holdeplass-7-tregt-nett-og-raske-fingre) | indikatorer og `hx-sync` |
| 8 | [Hold to faner i takt](#holdeplass-8-hold-to-faner-i-takt) | SSE: oppdateringer fra serveren |

Hvert steg har 💡 **Hint** og ✅ **løsningsforslag** i utslåbare blokker. Løsningen er ett mulig
svar, ikke fasit.

> 🧭 **Falt du av?** Hver holdeplass har en Git-gren som inneholder koden ferdig til og med det
> steget:
>
> ```bash
> git switch losning/holdeplass-03
> git switch main
> ```
>
> Løsningsgrenene inneholder ferdig kode. Startpunktet ligger på `main`.

---

## Før vi begynner: appen virker allerede

Prøv å søke, endre en forsinkelse og innstille en avgang før du skriver htmx. Alt fungerer med
vanlige lenker og skjemaer: serveren tar imot en POST og sender nettleseren videre til en ny side.

Legg merke til hva du mister ved hver handling:

- nettleseren laster hele dokumentet
- scroll og fokus flytter seg
- serveren lager hele siden på nytt, selv om bare én rad er endret
- den andre fanen vet ingenting

Dette er baselinen htmx skal forbedre. Hvis appen slutter å fungere uten JavaScript, har vi også
fjernet noe underveis.

---

## Holdeplass 1: Søk uten sidelasting

**🎯 Oppgave:** Last htmx og gjør søkefeltet levende. Etter en kort skrivepause skal
`/avganger` hentes, og bare `#departure-board` skal erstattes. URL-en skal følge søket.

Se på forespørselen i Network-panelet. Hva er `HX-Request`? Hva returnerer serveren nå,
sammenlignet med når du åpner samme URL i en ny fane?

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- Last `/vendor/htmx/htmx.min.js` med `defer` i `<head>`.
- Skjemaet skal gjøre en `GET` til `/avganger`.
- Lytt både på submit og på `input` fra søkefeltet.
- `changed delay:400ms` unngår en forespørsel for hvert tastetrykk.
- Svaret inneholder selve `#departure-board`, så bruk `outerHTML`.

📖 **Attributtene:** [hx-get](https://htmx.org/attributes/hx-get/) ·
[hx-trigger](https://htmx.org/attributes/hx-trigger/) ·
[hx-target](https://htmx.org/attributes/hx-target/) ·
[hx-swap](https://htmx.org/attributes/hx-swap/) ·
[hx-push-url](https://htmx.org/attributes/hx-push-url/)

📖 **Bakgrunn og eksempel:**
[HTTP-headerne htmx sender](https://htmx.org/reference/#request_headers) ·
[Active Search](https://htmx.org/examples/active-search/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

I `<head>`:

```html
<script src="/vendor/htmx/htmx.min.js" defer></script>
```

På søkeskjemaet:

```html
<form
    action="/avganger"
    method="GET"
    hx-get="/avganger"
    hx-trigger="input changed delay:400ms from:#departure-search, submit"
    hx-target="#departure-board"
    hx-swap="outerHTML"
    hx-push-url="true"
>
```

🔑 **Poenget:** URL-en er fortsatt en ekte, åpnebar URL, og serveren returnerer fortsatt HTML.
`HX-Request` lar den velge mellom en hel side og en liten del av siden.

Serveren bruker også `Vary` for å fortelle mellomlagre at svaret avhenger av htmx-headerne. Hvis
htmx må hente en gammel URL på nytt fra historikken, returnerer serveren en hel side.

</details>

---

## Holdeplass 2: Åpne redigering på stedet

«Endre» navigerer til en ny sidevariant. La lenken i stedet hente redigeringsversjonen av akkurat
den raden.

**🎯 Oppgave:** Gjør Endre-lenken til en htmx-forespørsel som erstatter nærmeste `<tr>`.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- URL-en finnes allerede i `href`. Bruk samme verdi i `hx-get`.
- `hx-target` støtter utvidede selektorer som `closest tr`.
- Hele raden må erstattes, ikke innholdet inni raden.
- Gi Avbryt-lenken samme behandling, men la den hente visningsversjonen av raden.

📖 [htmx: hx-get](https://htmx.org/attributes/hx-get/) ·
[htmx: hx-target og `closest`](https://htmx.org/attributes/hx-target/) ·
[htmx: hx-swap](https://htmx.org/attributes/hx-swap/) ·
[htmx-eksempel: Edit Row](https://htmx.org/examples/edit-row/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

På Endre-lenken:

```ejs
<a
    href="/avganger/<%= departure.id %>/rediger"
    hx-get="/avganger/<%= departure.id %>/rediger"
    hx-target="closest tr"
    hx-swap="outerHTML"
>Endre</a>
```

Bruk tilsvarende attributter på Avbryt-lenken, med `/avganger/<%= departure.id %>` som URL.

🔑 **Poenget:** Én rad er en avgrenset del av HTML-en som serveren kan lage både i visningsmodus
og redigeringsmodus. Vi trenger ingen JavaScript-komponent for å holde orden på den.

</details>

---

## Holdeplass 3: Lagre en liten del av siden

Redigeringsskjemaet gjør fortsatt en vanlig POST og sender nettleseren til en ny side.

**🎯 Oppgave:** Send skjemaet med htmx, og bytt redigeringsraden med raden serveren returnerer.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- `hx-post` kan stå på selve skjemaet.
- Målet og måten innholdet byttes på, er den samme som på Endre-lenken.
- Sammenlign svaret med en vanlig POST: htmx får `200` med én rad, mens en vanlig POST sender
  nettleseren videre til hele siden.

📖 [htmx: hx-post](https://htmx.org/attributes/hx-post/) ·
[htmx: skjemaverdier og parametere](https://htmx.org/docs/#parameters) ·
[htmx: forespørsler og svar](https://htmx.org/docs/#requests) ·
[htmx-eksempel: Edit Row](https://htmx.org/examples/edit-row/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

```ejs
<form
    action="/avganger/<%= departure.id %>/forsinkelse"
    method="POST"
    hx-post="/avganger/<%= departure.id %>/forsinkelse"
    hx-target="closest tr"
    hx-swap="outerHTML"
>
```

🔑 **Poenget:** Etter en vellykket htmx-POST kan serveren returnere den oppdaterte raden direkte
som HTML. Den trenger ikke først å sende nettleseren videre til en ny GET.

</details>

---

## Holdeplass 4: Innstill med bekreftelse

**🎯 Oppgave:** Forbedre Innstill-skjemaet på samme måte, men be om bekreftelse før
forespørselen sendes. Raden skal byttes med den innstilte versjonen serveren returnerer.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- Handlingen bruker POST fordi vanlig HTML bare støtter GET og POST i skjemaer.
- `hx-confirm` stopper forespørselen til brukeren har svart.
- Bekreftelsen må gi mening både for «Innstill» og «Sett opp igjen».

📖 [htmx: hx-post](https://htmx.org/attributes/hx-post/) ·
[htmx: hx-confirm](https://htmx.org/attributes/hx-confirm/) ·
[htmx-eksempel: Dialogs](https://htmx.org/examples/dialogs/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

Legg dette på skjemaet. Handlingen må følge teksten på knappen, slik at to like forespørsler ikke
kan oppheve hverandre:

```ejs
hx-post="/avganger/<%= departure.id %>/<%= departure.cancelled ? 'sett-opp' : 'innstill' %>"
hx-target="closest tr"
hx-swap="outerHTML"
hx-confirm="Vil du endre status for denne avgangen?"
```

🔑 **Poenget:** Vi beholder et vanlig skjema som også virker uten htmx. htmx-attributtene endrer
hvordan skjemaet sendes og hvor svaret vises, ikke hva handlingen betyr.

</details>

---

## Holdeplass 5: Oppdater flere steder samtidig

Når du forsinker eller innstiller en avgang, oppdateres raden – men tallene under «Situasjonen
nå» er utdaterte.

**🎯 Oppgave:** La samme svar fra serveren oppdatere både raden og `#summary`.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- `departure-update.ejs` er svaret etter endringen.
- Inkluder `summary.ejs` i det samme svaret.
- Marker sammendraget med `hx-swap-oob="outerHTML"`. Da kan det oppdateres selv om raden er
  hovedmålet for forespørselen.
- htmx plukker ut det merkede sammendraget før raden byttes inn.

📖 [htmx: out of band swaps](https://htmx.org/attributes/hx-swap-oob/) ·
[htmx: updating other content](https://htmx.org/examples/update-other-content/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

La `summary.ejs` ta imot en `oob`-verdi og skrive følgende attributt når den er sann:

```html
hx-swap-oob="outerHTML"
```

Inkluder den etter raden i `departure-update.ejs`:

```ejs
<%- include('summary', { summary, oob: true }) %>
```

Husk å sende `oob: false` når `summary.ejs` brukes som del av hele siden.

🔑 **Poenget:** Ett HTML-svar kan oppdatere flere steder på siden. Nettleseren trenger ikke
først å tolke JSON og deretter holde flere deler av siden synkronisert.

</details>

---

## Holdeplass 6: La feilsvar bli brukergrensesnitt

Skriv `121` som forsinkelse og lagre. Serveren svarer med `422 Unprocessable Content` og en rad
som forklarer feilen – men htmx bytter den ikke inn.

**🎯 Oppgave:** Konfigurer htmx til å bytte inn innholdet fra 422-svar, uten å gjøre alle
andre feilsvar til vanlig innhold.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- Standardregelen for 4xx er `swap: false`.
- htmx kan konfigureres direkte i HTML med `<meta name="htmx-config">`.
- Rekkefølgen på reglene betyr noe. `422` må stå før den generelle 4xx-regelen.

📖 [htmx: configuring response handling](https://htmx.org/docs/#response-handling) ·
[htmx: konfigurasjonsreferanse](https://htmx.org/reference/#config) ·
[htmx-eksempel: Inline Validation](https://htmx.org/examples/inline-validation/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

Legg dette i `<head>`:

```html
<meta
    name="htmx-config"
    content='{
        "responseHandling": [
            {"code": "204", "swap": false},
            {"code": "[23]..", "swap": true},
            {"code": "422", "swap": true},
            {"code": "[45]..", "swap": false, "error": true},
            {"code": "...", "swap": true}
        ]
    }'
/>
```

🔑 **Poenget:** Serveren kan bruke riktig HTTP-status og samtidig returnere HTML-en som viser
feilen. Feil trenger ikke et eget JSON-format, og skjemaet beholder verdien brukeren faktisk
sendte inn.

</details>

---

## Holdeplass 7: Tregt nett og raske fingre

Søket har en kunstig forsinkelse på ett sekund. Begynn på et nytt søk mens det forrige fortsatt
venter, og se på forespørslene i Network-panelet.

**🎯 Oppgave:** Vis indikatoren mens søket pågår, og la et nytt søk erstatte et gammelt som
fortsatt venter.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- Pek `hx-indicator` på `.spinner`.
- Når indikatoren er aktiv, får den klassen `htmx-request`.
- `hx-sync="this:replace"` betyr at en ny forespørsel fra samme skjema avbryter den gamle.
- Indikatoren er dekorativ; resultatstatusen blir allerede lest opp av skjermlesere.

📖 [htmx: hx-indicator](https://htmx.org/attributes/hx-indicator/) ·
[htmx: hx-sync](https://htmx.org/attributes/hx-sync/) ·
[htmx-eksempel: Active Search](https://htmx.org/examples/active-search/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

På søkeskjemaet:

```html
hx-indicator=".spinner"
hx-sync="this:replace"
```

I CSS-en:

```css
.spinner.htmx-request {
    display: inline;
}
```

🔑 **Poenget:** Ny input kan komme mens et gammelt svar fortsatt venter. Vi må velge om slike
forespørsler skal stå i kø, droppes eller avbrytes. Her avbryter htmx det gamle søket.

</details>

---

## Holdeplass 8: Hold to faner i takt

Åpne appen i to faner. Endre en forsinkelse i den ene. Den andre er fortsatt utdatert.

**🎯 Oppgave:** Last SSE-utvidelsen, koble tavlen til `/hendelser`, og bytt inn hendelsen som
heter `avganger`. Et aktivt søk skal fortsatt være aktivt når en hendelse kommer.

<details>
<summary>💡 <b>Hint</b></summary>

<br>

- Last `/vendor/htmx-ext-sse/sse.js` etter htmx.
- `partials/live-departures.ejs` inneholder elementet som skal beholde SSE-forbindelsen når tavlen
  byttes.
- Elementet trenger `hx-ext="sse"`, en tilkobling som tar med søket, og
  `sse-swap="avganger"`.
- Endre søkemålet til `#live-departures`. Da returnerer serveren både koblingen og den filtrerte
  tavlen, og SSE kobler seg til på nytt med riktig søk.
- Serveren sender ferdig HTML som innhold i hendelsen. Det er ingen JSON å tolke.

📖 [htmx: hx-ext](https://htmx.org/attributes/hx-ext/) ·
[htmx: SSE-utvidelsen](https://htmx.org/extensions/sse/)

</details>

<details>
<summary>✅ <b>Løsningsforslag</b></summary>

<br>

I `<head>`:

```html
<script src="/vendor/htmx-ext-sse/sse.js" defer></script>
```

I `partials/live-departures.ejs`:

```ejs
<div
    id="live-departures"
    hx-ext="sse"
    sse-connect="/hendelser?q=<%= encodeURIComponent(query) %>"
    sse-swap="avganger"
>
    <!-- departure-board lages her -->
</div>
```

I `views/index.ejs` erstatter du den direkte inkluderingen av `departure-board` med:

```ejs
<%- include('partials/live-departures', {
    departures,
    query,
    editId,
    error,
    formatTime,
    expectedAt,
}) %>
```

Endre samtidig søkeskjemaets mål:

```html
hx-target="#live-departures"
```

Åpne to faner igjen og endre en avgang. Søk etter «Bergen» i den ene fanen før du endrer en
avgang i den andre. Bergen-fanen skal fortsatt vise ett treff, og «Situasjonen nå» skal være
oppdatert i begge.

🔑 **Poenget:** Hver fane forteller serveren hvilket søk den viser. Serveren sender riktig tavle
og oppsummering som HTML til hver tilkobling. Fanene trenger ingen egen kopi av avgangene eller
JavaScript som oversetter en melding til endringer i siden.

</details>

---

## 🛤️ Sidespor

### Behold fokus etter et radbytte

Naviger hele appen med tastaturet. Hvor havner fokus når Endre-lenken erstattes av et skjema, og
når skjemaet blir til en rad igjen? Prøv stabile id-er og `focus-scroll`-modifikatoren. Hvem bør
bestemme hvilket element som får fokus?

📖 [htmx: focus preservation](https://htmx.org/docs/#focus-scroll)

### Sammenlign polling og SSE

Bytt SSE-forbindelsen med `hx-trigger="every 2s"` og `hx-get="/avganger"`. Sammenlign antall
forespørsler, hvor raskt den andre fanen oppdateres og hva som skjer når fanen ligger i
bakgrunnen.

📖 [htmx: polling med hx-trigger](https://htmx.org/attributes/hx-trigger/#polling)

### Fjern htmx

Blokker JavaScript i DevTools. Søk, rediger og innstill en avgang. Hva virker fortsatt? Hvilke
ting er nødvendigvis forbedringer, og hvilke har blitt krav?

### Beskytt mot HTML-injeksjon

EJS bruker `<%=` når spesialtegn i tekst skal gjøres ufarlige, og `<%-` for rå HTML. Finn
begge variantene i prosjektet. Hvorfor er rå HTML nødvendig når vi setter inn malfiler, og
hvorfor ville den vært farlig rundt data fra en bruker?

📖 [htmx: Web Security Basics](https://htmx.org/essays/web-security-basics-with-htmx/)

---

## 🏁 Endestasjon

Diskuter gjerne før dere pakker sammen:

- Hvor lagres avgangene og statusene deres?
- Er HTML-svarene et API?
- Ble koblingen mellom server og brukergrensesnitt sterkere eller svakere enn med JSON?
- Hvilke feil oppdager TypeScript ikke når avtalen mellom server og nettleser er HTML?
- Hva skjer med mellomlagring når samme URL kan returnere en hel side eller bare en liten del?
- Hvor mye av dette ville vært enklere med React – og hva ville blitt mer komplekst?
- Når er htmx feil verktøy?

📖 [htmx: When Should You Use Hypermedia?](https://htmx.org/essays/when-to-use-hypermedia/)

### Hva betalte vi?

Vi slapp å ha en egen kopi av avgangene og statusene deres i nettleseren, men fikk andre hensyn:

- serveren må kunne lage de samme avgrensede HTML-delene på en forutsigbar måte
- fokus og historikk må fortsatt designes
- flere forespørsler kan pågå samtidig og komme tilbake i feil rekkefølge
- mellomlagring må skille mellom hele sider og delsvar når de har samme URL
- HTML-injeksjon blir ekstra alvorlig når HTML-en kan uttrykke handlinger
- liveforbindelser må kunne koble seg til på nytt og håndtere mange brukere og tilgangskontroll

Mindre JavaScript fjerner ikke vanskelige designvalg. Flere av dem flyttes fra nettleseren til
serveren.

---

## 🗺️ Kart over prosjektet

```text
app.js                              🚂 Ruter, avganger og SSE
data.js                             🕐 Simulerte avganger
server.js                           ▶️ Starter serveren
views/index.ejs                     📄 Servermal for hele dokumentet
views/partials/departure-board.ejs  🪧 Servermal for tavlen
views/partials/departure-row.ejs    🚆 Servermal for én avgang
views/partials/departure-update.ejs 📦 Servermal for svaret etter en endring
views/partials/summary.ejs          🔢 Servermal for situasjonen nå
public/index.css                    🎨 Linje-variabler og lokal styling
test/app.test.js                    🧪 HTTP-svarene fra serveren
```

---

## 📚 Ressurser

- [htmx-dokumentasjonen](https://htmx.org/docs/)
- [Komplett htmx-referanse](https://htmx.org/reference/)
- [Offisielle htmx-eksempler](https://htmx.org/examples/)
- [Når passer hypermedia?](https://htmx.org/essays/when-to-use-hypermedia/)
- [Sikkerhet med htmx](https://htmx.org/essays/web-security-basics-with-htmx/)
- [Hypermedia Systems](https://hypermedia.systems/)
- [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Entur Linje: universell utforming](https://linje.entur.no/universell-utforming)
