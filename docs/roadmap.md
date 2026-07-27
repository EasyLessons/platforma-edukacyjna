# Roadmap — zaplanowane funkcje (jeszcze nie zaimplementowane)

Rzeczy, które wiadomo że nadejdą, zanim jeszcze jest kod. Cel: żeby architektura dziś nie zamykała drogi do tego co ma przyjść — patrz odpowiednie sekcje w `docs/architecture/*` gdzie już zarezerwowano na to miejsce.

## Poziom subskrybenta (płatny plan)

Trzeci stan usera obok zalogowany/niezalogowany. Szczegóły architektoniczne (model danych, warstwa autoryzacji, co zmienić na froncie) opisane w `docs/architecture/auth.md`, sekcja "Planowane: poziom subskrybenta". Status: **niezaczęte**, tylko zaplanowane.

Otwarte pytania do rozstrzygnięcia przed startem prac (uzupełnić gdy będzie decyzja):
- Dostawca płatności (Stripe czy inny)?
- Co dokładnie odblokowuje subskrypcja (funkcje AI? liczba workspace'ów/boardów? coś innego)?
- Czy plany darmowy/płatny, czy więcej poziomów?

## Miejsce na kolejne punkty

Ten plik ma rosnąć w miarę ustalania kolejnych funkcji na przyszłość — dopisywać tu od razu jak coś zostanie zdecydowane, nawet zanim ruszy implementacja, żeby dokumentacja architektury mogła to od razu uwzględnić (tak jak w tej chwili zrobiono z subskrybentem).
