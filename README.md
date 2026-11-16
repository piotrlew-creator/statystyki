# Statystyki meczu

Aplikacja na smartfon do błyskawicznego zapisywania statystyk meczu koszykówki na żywo.
Działa w przeglądarce, da się ją zainstalować na ekranie głównym telefonu i działa także bez internetu.

**Adres (GitHub Pages):** https://piotrlew-creator.github.io/statystyki/

## Jak to działa

1. **Drużyny** — jedną z drużyn jest zawsze **ŁKS U15**; wybierasz, czy gra jako gospodarz, czy gość.
   Dla rywala podajesz nazwę. Obu drużynom ustawiasz kolor strojów i decydujesz, dla której (lub obu) prowadzisz statystyki.
2. **Skład meczowy / zawodnicy** — ŁKS U15 ma stały skład (lista `LKS_ROSTER` w `js/app.js`); dotykasz zawodników,
   którzy grają w danym meczu. Można dodać zawodnika spoza listy tylko na jeden mecz.
   Dla rywala: numer i nazwisko (obowiązkowe), imię (opcjonalne); można wkleić całą listę naraz
   (jeden zawodnik w linii: `numer nazwisko imię`).
3. **Pierwsza piątka** — dotknij pięciu zawodników.
4. **Mecz** — dotknij zawodnika, a potem akcji (albo odwrotnie). Każda akcja to 2 dotknięcia.
   - Celny rzut liczy się też jako rzut wykonany.
   - Po celnym rzucie za 2 lub 3 aplikacja przez 5 sekund podpowiada **asystę**: wystarczy dotknąć podającego.
   - Po niecelnym rzucie podpowiada **zbiórkę**: dotknij zbierającego. Atak lub obrona rozpoznają się same.
   - Gdy prowadzisz obie drużyny: po przechwycie podpowiada **stratę** rywala, a po faulu **faul wymuszony** (i odwrotnie).
   - Dla drużyny bez statystyk są przyciski +1 / +2 / +3, żeby wynik się zgadzał.
   - Zmiany zawodników: przycisk **⇄ Zmiany** przy drużynie.
   - Kwarta: dotknij przycisku kwarty na środku tablicy wyników.
   - **Cofnij** usuwa ostatnią akcję. W **Akcje** możesz usunąć dowolną akcję z listy.
   - **Rzuty wolne:** po rzucie za 1 w pasku pojawia się „Kolejny wolny?” z przyciskami ✓ / ✕ — kolejny wolny to 1 dotknięcie.
   - **And-one:** po celnym rzucie za 2/3 przycisk „+ faul” zapisuje faul wymuszony i od razu pyta o rzut wolny (i faulującego, gdy prowadzisz obie drużyny).
   - **Szybka zmiana:** przytrzymaj kafelek zawodnika (pół sekundy) i dotknij wchodzącego z ławki.
   - **5. faul:** aplikacja sama otwiera okno zmiany dla tego zawodnika.
   - **Rywal bez statystyk:** pasek na dole ekranu: +1 / +2 / +3, „✕ niecelny”, „ZB atak”, „Strata” i „Faul”.
     Po niecelnym rzucie rywala dotknij zbierającego z ŁKS (= zbiórka w obronie) albo „ZB rywala”; po faulu rywala dotknij zawodnika ŁKS, który go wymusił.
     Automatycznie liczą się też: faul wymuszony ŁKS → faul rywala, przechwyt ŁKS → strata rywala, blok ŁKS → niecelny rzut rywala.
   - **Ocena obrony ŁKS:** „Przegrany 1×1”, „Dobra obrona”, „Dobra pomoc”, „Zła rotacja” — wpływają tylko na EVAL końcowy.
   - **Poprawianie:** w „Akcje” dotknij akcji, aby zmienić zawodnika, rodzaj akcji lub kwartę.
   - Każda akcja daje krótki „błysk” na kafelku zawodnika — widać kątem oka, że się zapisała.
   - **Ostatnie akcje:** wąski pasek pod kafelkami pokazuje 4 ostatnie zapisane akcje (najnowsza po lewej); dotknięcie otwiera pełną listę.
   - **Faule:** żółte „F” na kafelku przy kłopotach z faulami (2 w 1. kwarcie, 3 do przerwy, 4 w drugiej połowie) oraz znacznik **LIMIT** przy 4 faulach drużyny w kwarcie (kolejne = rzuty wolne).
   - **Wibracja** po zapisaniu akcji (Android; iPhone z iOS 18 — krótki „tik”), wyłączana w Menu.
   - **Skład i piątka z ostatniego meczu:** przyciski „↺ Skład z ostatniego meczu” i „↺ Piątka z ostatniego meczu” (zapamiętane na tym telefonie).
   - **Jasny motyw:** przełącznik w Menu i na ekranie startowym (zapamiętywany na tym urządzeniu) — przydatny w bardzo jasnej hali.
5. **Tabela** — statystyki wszystkich zawodników, eksport do PDF i udostępnianie (np. WhatsApp, e-mail).
   Raport: kolumny w grupach (RZUTY, ZBIÓRKI, GRA, OCENA OBRONY), kolumna Z GRY (rzuty za 2 i 3 razem), najlepszy wynik w każdej kolumnie na zielono, wyróżniona kolumna EVAL K,
   statystyki drużyny w kwartach oraz najskuteczniejsze piątki (bilans +/− gdy dana piątka grała razem). U rywala: ile trafił za 3, za 2 i rzutów wolnych.
   Raport: najpierw ŁKS (zawodnicy jako „Nazwisko I.”, rzuty jako celne/wykonane ze skutecznością, np. 8/10 (80%)), a na końcu osobno rywal — lista punktowana.

## EVAL końcowy (EVAL K)

`EVAL K = EVAL − przegrane pojedynki 1×1 + dobra obrona + dobra pomoc − złe rotacje`

W tabeli i PDF za kolumną EVAL: P1×1, DO, DP, ZR, EVAL K.

## +/− (plus/minus)

Różnica punktów (zdobyte − stracone przez drużynę), gdy zawodnik był na boisku. Aplikacja zapisuje skład na boisku przy każdej akcji, więc nie wymaga to żadnych dodatkowych dotknięć.

## EVAL

`EVAL = punkty − wszystkie niecelne rzuty (za 1, 2 i 3) + asysty + przechwyty + zbiórki w ataku + zbiórki w obronie + bloki − straty`

## Zapis w Arkuszu Google (opcjonalnie)

Po zakończeniu meczu statystyki mogą się zapisywać w Twoim Arkuszu Google:
arkusze **Mecze**, **Statystyki** (wiersz na zawodnika), **Sezon** (sumy i średnie ŁKS U15) oraz **Przebieg** (pełna lista akcji).

- Skrypt do wklejenia w Arkuszu Google: `google-apps-script/Code.gs` (ustaw w nim swój `PIN`).
- Adres skryptu i PIN wpisujesz raz w aplikacji (Menu lub ekran startowy → „Arkusz Google”). Zostają tylko na telefonie,
  nie ma ich w kodzie w repozytorium.
- „Zakończ mecz” wysyła mecz automatycznie; w tabeli jest też przycisk „Zapisz w Arkuszu Google”.
- Bez internetu mecz czeka w kolejce i wysyła się sam, gdy wróci zasięg. Ponowne wysłanie nadpisuje mecz (bez duplikatów).

## Dane

Bez skonfigurowanego Arkusza Google nic nie jest wysyłane na żaden serwer. Bieżący mecz jest przechowywany tylko w pamięci przeglądarki na tym telefonie,
żeby nie przepadł po przypadkowym odświeżeniu strony lub zamknięciu przeglądarki. „Nowy mecz” go usuwa.

## Pliki

| Plik | Co zawiera |
|---|---|
| `index.html` | szkielet strony |
| `css/style.css` | wygląd |
| `js/app.js` | cała logika aplikacji; na górze stały skład ŁKS U15 (`LKS_ROSTER`) |
| `lib/` | pdfmake (generowanie PDF z polskimi znakami) |
| `sw.js` | działanie offline. **Po każdej zmianie plików podbij `VERSION` w `sw.js` i `APP_VERSION` w `js/app.js`** — numer wersji widać na ekranie startowym aplikacji |
| `manifest.webmanifest`, `icons/` | instalacja na ekranie głównym telefonu |
