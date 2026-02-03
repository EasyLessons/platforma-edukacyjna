# Nowe Narzędzia - Quick Reference

### 1. **ESLint** - Sprawdza błędy w kodzie

**Co robi?** Wyłapuje błędy zanim uruchomisz aplikację.

**Jak używać?**
```bash
npm run lint        # Sprawdź błędy
npm run lint:fix    # Napraw automatycznie
```

**W VS Code:**
- Czerwone podkreślenia = błędy (musisz naprawić)
- Żółte podkreślenia = ostrzeżenia (powinieneś naprawić)
- Zainstalować rozszerzenie ESLint

**WAŻNE:** Przed każdym commitem uruchom `npm run lint` - musi pokazać **0 errors**

---

### 2. **Prettier** - Formatuje kod automatycznie

**Co robi?** Zawsze ten sam, ładny format kodu.

**Jak używać?**
```bash
npm run format  # Sformatuj cały projekt
```

**Lepiej: Włącz w VS Code:**
1. Zainstaluj rozszerzenie "Prettier - Code formatter"
2. Włącz "Format On Save" w ustawieniach
3. **Ctrl+S** → kod formatuje się automatycznie

---

### 3. **React Query** - Dane z API

**Co robi?** Zamienia 50 linii kodu na 5 linii.

**Stary sposób:**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/workspaces')
    .then(res => setData(res))
    .finally(() => setLoading(false));
}, []);
```

**Nowy sposób:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['workspaces'],
  queryFn: () => fetch('/api/workspaces'),
});
```

**Korzyści:**
- Auto-caching (nie fetuje 2x tych samych danych)
- Auto-retry (spróbuje ponownie przy błędzie)
- Optimistic updates (UI zmienia się NATYCHMIAST)

---

### Podczas kodowania:

1. Pisz kod normalnie
2. **Ctrl+S** → Prettier formatuje automatycznie
3. Sprawdzaj podkreślenia ESLint
4. Napraw błędy na bieżąco

### Przed commitem:

```bash
npm run lint      # ← Musi pokazać 0 errors!
npm run format    # ← Sformatuj kod
git add .
git commit -m "..."
```

---

## NAJCZĘSTSZE PROBLEMY

### "ESLint pokazuje 100 błędów!"

```bash
npm run lint:fix  # Napraw automatycznie co się da
# Resztę napraw ręcznie, plik po pliku
```

### "Konflikt w package-lock.json"

```bash
rm package-lock.json
npm install
git add package-lock.json
```

---

## 📦 VS CODE SETUP (5 minut)

### 1. Zainstaluj rozszerzenia:

- **ESLint** (by Microsoft)
- **Prettier - Code formatter** (by Prettier)

### 2. Stwórz `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### 3. Zrestartuj VS Code

**Test:** Otwórz plik `.tsx`, naciśnij Ctrl+S → powinien się sformatować!

---

## KOMENDY DO ZAPAMIĘTANIA

```bash
# Deweloperskie
npm run dev           # Uruchom projekt
npm run lint          # Sprawdź błędy
npm run lint:fix      # Napraw błędy automatycznie
npm run format        # Sformatuj kod

# Przed commitem
npm run lint          # ← Musi być 0 errors
npm run format        # ← Sformatuj
```
