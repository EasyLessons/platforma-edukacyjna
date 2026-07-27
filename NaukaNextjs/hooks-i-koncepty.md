# Nauka Next.js i React hooki

To jest nasza wspólna ściąga. Będę tu dopisywać kolejne rzeczy, a ty możesz pytać o każdy fragment.

## `useState`

Służy do trzymania stanu, czyli wartości, która może się zmieniać i po zmianie ma odświeżyć UI.

Kiedy używać:

- gdy coś ma się zmieniać w komponencie
- gdy kliknięcie, wpisywanie albo odpowiedź z API ma wpłynąć na ekran

Przykład:

```tsx
const [count, setCount] = useState(0);
```

To znaczy:

- `count` = aktualna wartość
- `setCount` = funkcja do zmiany tej wartości

## `useEffect`

Służy do uruchamiania kodu po renderze albo gdy zmienią się konkretne dane.

Kiedy używać:

- gdy chcesz pobrać dane z API
- gdy chcesz ustawić timer
- gdy chcesz zasubskrybować coś z zewnątrz
- gdy chcesz zareagować na zmianę stanu lub propsów

Przykład:

```tsx
useEffect(() => {
  console.log('Komponent się pokazał albo coś się zmieniło');
}, []);
```

Pusta tablica `[]` znaczy: uruchom tylko raz po pierwszym renderze.

## `useRef`

Służy do trzymania czegoś, co ma przetrwać między renderami, ale nie ma powodować ponownego renderu po zmianie.

Kiedy używać:

- gdy chcesz mieć dostęp do elementu HTML
- gdy chcesz trzymać timer, kanał, poprzednią wartość albo dowolny obiekt pomocniczy
- gdy zmiana nie powinna odświeżać UI

Przykład:

```tsx
const inputRef = useRef<HTMLInputElement | null>(null);
```

To znaczy:

- `inputRef.current` może wskazywać na prawdziwy input
- możesz na nim np. zrobić `focus()`

## `useMemo`

Służy do zapamiętania wyniku obliczenia, żeby nie liczyć go od nowa przy każdym renderze, jeśli dane się nie zmieniły.

Kiedy używać:

- gdy masz ciężkie obliczenie
- gdy tworzysz dużą listę danych i nie chcesz jej liczyć w kółko
- gdy chcesz stabilny wynik jakiegoś wyliczenia

Przykład:

```tsx
const filteredItems = useMemo(() => {
  return items.filter((item) => item.active);
}, [items]);
```

To znaczy:

- jeśli `items` się nie zmieniło, React da stary wynik
- jeśli `items` się zmieniło, React policzy od nowa

## `useCallback`

Służy do zapamiętania funkcji, żeby React nie tworzył nowej wersji tej samej funkcji przy każdym renderze, jeśli zależności się nie zmieniły.

Kiedy używać:

- gdy przekazujesz funkcję do dziecka
- gdy używasz funkcji w `useEffect` albo w zależnościach innych hooków
- gdy chcesz, żeby funkcja miała stabilną tożsamość

Przykład:

```tsx
const handleClick = useCallback(() => {
  setCount((c) => c + 1);
}, []);
```

To znaczy:

- funkcja zostaje ta sama między renderami
- nie jest tworzona od nowa bez potrzeby

## `useContext`

Służy do pobierania danych ze wspólnego miejsca, bez przekazywania ich przez wiele komponentów po drodze.

Kiedy używać:

- gdy kilka komponentów potrzebuje tych samych danych
- gdy nie chcesz robić łańcucha propsów przez pół aplikacji

Przykład:

```tsx
const user = useContext(UserContext);
```

## Najkrótsza różnica

- `useState` = przechowuje stan i powoduje render
- `useEffect` = robi coś po renderze albo po zmianie danych
- `useRef` = trzyma coś bez renderu
- `useMemo` = zapamiętuje wynik obliczenia
- `useCallback` = zapamiętuje funkcję
- `useContext` = bierze dane ze wspólnego kontekstu

## Jak to czuć w praktyce

- jeśli coś ma się wyświetlać i zmieniać na ekranie, zwykle myślisz o `useState`
- jeśli coś ma się odpalić „po drodze”, zwykle myślisz o `useEffect`
- jeśli chcesz pamiętać coś technicznego bez odświeżania UI, zwykle myślisz o `useRef`
- jeśli liczysz coś ciężkiego, myślisz o `useMemo`
- jeśli przekazujesz funkcję i chcesz, żeby nie była ciągle nowa, myślisz o `useCallback`
- jeśli chcesz wspólne dane dla wielu komponentów, myślisz o `useContext`
