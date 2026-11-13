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
   - **Rywal bez statystyk:** pasek na dole ekranu: +1 / +2 / +3, „ZB atak” (zbiórki rywala na atakowanej desce — w tabeli i PDF obok zbiórek w obronie ŁKS) i „Faul” (licznik fauli zespołowych).
   - **Poprawianie:** w „Akcje” dotknij akcji, aby zmienić zawodnika, rodzaj akcji lub kwartę.
   - Każda akcja daje krótki „błysk” na kafelku zawodnika — widać kątem oka, że się zapisała.
5. **Tabela** — statystyki wszystkich zawodników, eksport do PDF i udostępnianie (np. WhatsApp, e-mail).

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
