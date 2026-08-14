# Familiada Weselna — aplikacja desktopowa (Electron, 2 okna)

Gra imprezowa w stylu „Familiady” do prowadzenia zabawy na weselu. Aplikacja
uruchamia się w **dwóch osobnych oknach**:

1. **Panel Prowadzącego** — okno sterujące (dla wodzireja/starosty): tu
   konfigurujesz grę, odsłaniasz odpowiedzi, przyznajesz punkty, dodajesz X.
2. **Plansza** — okno wyłącznie do wyświetlania (dla gości/na projektor):
   pokazuje tablicę z odpowiedziami, wyniki, X-y — bez żadnych przycisków
   sterujących. Aktualizuje się automatycznie na żywo, gdy prowadzący coś
   kliknie w swoim oknie.

Oba okna komunikują się przez Electron IPC (nie przez internet, nie przez
przeglądarkę) — działają w pełni offline.

## Wymagania

- [Node.js](https://nodejs.org) 18+ (zawiera `npm`)

## Uruchomienie w trybie deweloperskim

```bash
npm install
npm start
```

Otworzą się od razu dwa okna. Jeśli komputer wykryje drugi monitor/projektor,
okno Planszy samo się na nim otworzy w pełnym ekranie — jeśli nie, przeciągnij
je ręcznie na projektor i wciśnij `F11` (pełny ekran działa niezależnie dla
każdego okna, `Esc` wychodzi z pełnego ekranu).

Jeśli ktoś przypadkiem zamknie okno Planszy, w Panelu Prowadzącego kliknij
**„🖥️ Pokaż okno Planszy”** — otworzy się ono ponownie z aktualnym stanem gry.
Zamknięcie okna Prowadzącego kończy całą aplikację (razem z Planszą).

## Struktura projektu

```
familiada-electron/
├── package.json          ← konfiguracja npm + electron-builder (build .exe)
├── main.js                 ← proces główny: tworzy 2 okna, przekazuje stan gry
│                              między nimi przez IPC, obsługuje dialogi plików
├── preload.js               ← bezpieczny "most" (contextBridge) do obu okien
├── src/
│   ├── host.html              ← struktura okna Prowadzącego
│   ├── host-renderer.js        ← cała logika gry: rundy, punkty, X, edytor pytań,
│   │                              dźwięki (dźwięk gra tylko w tym oknie)
│   ├── board.html              ← struktura okna Planszy (tylko wyświetlanie)
│   ├── board-renderer.js        ← odbiera stan gry przez IPC i renderuje planszę
│   └── style.css                 ← wspólny styl obu okien
└── assets/                        ← tu możesz wrzucić własną ikonę aplikacji
```

## Budowanie pliku `.exe`

```bash
npm install
npm run dist:win
```

W folderze `release/` znajdziesz instalator NSIS oraz wersję **portable**
(uruchamiana bez instalacji — wygodna na pendrive na wesele).

> Budowanie `.exe` najpewniej działa uruchomione bezpośrednio na Windows.
> Cross-build z Linuksa/macOS bywa kapryśny. Mogę przygotować gotowy workflow
> GitHub Actions budujący `.exe` automatycznie w chmurze (`windows-latest`),
> jeśli nie masz Windows pod ręką.

## Własna ikona aplikacji

1. Przygotuj `icon.ico` (min. 256×256).
2. Wrzuć do `assets/icon.ico`.
3. W `package.json`, w `"build" → "win"`, dodaj: `"icon": "assets/icon.ico"`.

## Poprawka: nie dało się nic wpisać (nazwy drużyn, edytor pytań)

Przyczyną nie był brak logiki wpisywania, tylko **fokus klawiatury na złym oknie**.
Oba okna startowały jednocześnie, a stworzone jako drugie okno Planszy zabierało
fokus (i na pojedynczym monitorze mogło nawet nachodzić na okno Prowadzącego),
więc kliknięcia trafiały w pole tekstowe, ale klawiatura „mówiła” do okna Planszy,
które nie ma żadnych pól tekstowych. Naprawione w `main.js`:

- okno Planszy jest teraz tworzone jako **niewidoczne** i pokazywane przez
  `showInactive()`, które **nie** zabiera fokusu,
- fokus jest jawnie ustawiany z powrotem na okno Prowadzącego zaraz po pokazaniu Planszy,
- oba okna są automatycznie **rozmieszczane obok siebie bez nakładania się**
  (Prowadzący po lewej, Plansza po prawej), jeśli wykryto tylko jeden ekran;
  przy dwóch ekranach Plansza trafia w pełnym ekranie na drugi monitor.

## Poprawka: „ekran wracał do góry” w edytorze pytań

Wcześniej każde kliknięcie „+ Dodaj odpowiedź” / „🗑️ Usuń pytanie” w edytorze
przebudowywało cały modal od zera, przez co przewijanie wracało na sam
początek listy pytań. Teraz `renderEditor()` zapamiętuje pozycję przewijania
(i aktywne pole tekstowe z pozycją kursora) tuż przed przebudową HTML-a,
a zaraz po niej przywraca je z powrotem — dzięki temu edycja długiej listy
pytań nie wyrzuca Cię już na górę.

## Import / eksport pytań

W Panelu Prowadzącego import/eksport JSON korzysta z natywnych okien
dialogowych systemu Windows (zapisz/otwórz), obsługiwanych przez `main.js`
przez bezpieczny kanał IPC.

## Dlaczego Electron, a nie Tauri?

Tauri (Rust + WebView systemowy) daje dużo lżejszy plik `.exe`, ale wymaga
toolchainu Rust i — przy cross-buildzie z Linuksa/macOS — bywa niestabilny
poza samym Windowsem. Ten sam model dwuokienkowy (IPC między oknem
Prowadzącego a Planszą) da się przenieść na Tauri: zamiast Electron IPC
użyłbyś zdarzeń Tauri (`emit`/`listen`) między webview'ami. Mogę przygotować
pełny projekt Tauri jako kolejny krok, jeśli zależy Ci na jak najmniejszym
pliku wynikowym.
