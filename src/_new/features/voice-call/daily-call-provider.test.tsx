import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, ErrorCode } from '@/_new/lib/errors';
import { CallButton } from './components/call-button';
import { DailyCallProvider } from './daily-call-provider';

type Handler = (event?: unknown) => void;

interface FakeCall {
  handlers: Map<string, Handler[]>;
  emit: (event: string, payload?: unknown) => void;
  on: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isDestroyed: () => boolean;
  iframe: () => HTMLIFrameElement | null;
  localAudio: ReturnType<typeof vi.fn>;
  setLocalAudio: ReturnType<typeof vi.fn>;
}

const daily = vi.hoisted(() => ({
  calls: [] as unknown[],
  createFrame: vi.fn(),
}));
const api = vi.hoisted(() => ({ createBoardCall: vi.fn() }));

vi.mock('@daily-co/daily-js', () => ({ default: { createFrame: daily.createFrame } }));
vi.mock('./api/callApi', () => ({ createBoardCall: api.createBoardCall }));

const fakeCalls = () => daily.calls as FakeCall[];

/** Atrapa instancji z `DailyIframe.createFrame`: wstawia <iframe> do kontenera jak daily-js. */
function makeFakeCall(container: HTMLElement): FakeCall {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'microphone; camera; autoplay');
  container.appendChild(iframe);
  let destroyed = false;
  let audio = true;
  const handlers = new Map<string, Handler[]>();
  const call: FakeCall = {
    handlers,
    emit: (event, payload) => (handlers.get(event) ?? []).forEach((handler) => handler(payload)),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return call;
    }),
    // Jak w Daily z ekranem wejścia: join() rozstrzyga się dopiero po dołączeniu.
    join: vi.fn(() => new Promise(() => {})),
    leave: vi.fn(async () => {}),
    destroy: vi.fn(async () => {
      destroyed = true;
      iframe.remove();
    }),
    isDestroyed: () => destroyed,
    iframe: () => (destroyed ? null : iframe),
    localAudio: vi.fn(() => audio),
    setLocalAudio: vi.fn((value: boolean) => {
      audio = value;
      return call;
    }),
  };
  return call;
}

/** Wartości generowane w czasie testu - żadnych literałów wyglądających na sekret. */
const roomUrl = `https://example.daily.co/room-${crypto.randomUUID()}`;
const callToken = crypto.randomUUID();
const session = () => ({ room_url: roomUrl, token: callToken, expires_at: '2026-10-05T10:00:00Z' });

function renderCall(boardId: number | null = 7) {
  return render(
    <DailyCallProvider boardId={boardId}>
      <CallButton />
    </DailyCallProvider>
  );
}

const clickCall = () => fireEvent.click(screen.getByTestId('call-button'));
const panel = () => screen.getByTestId('call-panel');
const frames = () => document.querySelectorAll('iframe');

async function startCall() {
  clickCall();
  await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(panel()).toBeVisible());
  return fakeCalls()[0];
}

beforeEach(() => {
  daily.calls.length = 0;
  daily.createFrame.mockImplementation((container: HTMLElement) => {
    const call = makeFakeCall(container);
    daily.calls.push(call);
    return call;
  });
  api.createBoardCall.mockImplementation(async () => session());
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DailyCallProvider - start rozmowy', () => {
  it('klik -> API tablicy -> createFrame w kontenerze panelu -> join z adresem pokoju i tokenem', async () => {
    renderCall(7);
    expect(panel()).not.toBeVisible();

    const call = await startCall();

    expect(api.createBoardCall).toHaveBeenCalledWith(7);
    const [container, options] = daily.createFrame.mock.calls[0];
    expect(container).toBe(screen.getByTestId('call-frame'));
    // Domyślnie samo audio - kamerę włącza użytkownik w oknie Daily.
    expect(options).toMatchObject({ startVideoOff: true, startAudioOff: false, lang: 'pl' });
    expect(call.join).toHaveBeenCalledWith({ url: roomUrl, token: callToken });
    expect(frames()).toHaveLength(1);
  });

  it('ramka ma allow z mikrofonem, kamerą, autoplay i udostępnianiem ekranu', async () => {
    renderCall();
    await startCall();
    const allow = frames()[0].getAttribute('allow') ?? '';
    for (const name of ['microphone', 'camera', 'autoplay', 'display-capture']) {
      expect(allow).toContain(name);
    }
  });

  it('podwójne kliknięcie nie tworzy dwóch instancji', async () => {
    renderCall();
    clickCall();
    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panel()).toBeVisible());
    // Kolejny klik w trakcie rozmowy tylko zwija okno.
    clickCall();
    expect(api.createBoardCall).toHaveBeenCalledTimes(1);
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
    expect(frames()).toHaveLength(1);
  });

  it('StrictMode: podwójny montaż nie zostawia drugiej instancji', async () => {
    render(
      <StrictMode>
        <DailyCallProvider boardId={7}>
          <CallButton />
        </DailyCallProvider>
      </StrictMode>
    );
    await startCall();
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
    expect(frames()).toHaveLength(1);
  });

  it('token rozmowy nie trafia do logów ani do adresu strony', async () => {
    const spies = (['log', 'debug', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    );
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '1');
    renderCall();
    const call = await startCall();
    act(() => call.emit('error', { error: { type: 'ejected' }, errorMsg: callToken }));
    await waitFor(() => expect(screen.getByTestId('call-notice')).toBeInTheDocument());

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(callToken);
    expect(window.location.href).not.toContain(callToken);
    vi.unstubAllEnvs();
  });
});

describe('DailyCallProvider - błędy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const RETRY = 'Spróbuj ponownie';
  const message = () => screen.getByTestId('call-notice-message');

  // Kontrakt POST /api/v1/whiteboard/{id}/call: [kod, status, komunikat, rodzaj, czy jest ponowienie].
  // Treść błędu z backendu ("surowy ...") nie może trafić do UI.
  it.each([
    ['VOICE_NOT_CONFIGURED', 503, 'Rozmowa chwilowo niedostępna.', 'disabled', false],
    ['VOICE_DISABLED', 503, 'Rozmowa chwilowo niedostępna.', 'disabled', false],
    [
      'VOICE_CALL_NOT_STARTED',
      409,
      'Rozmowa jeszcze się nie zaczęła - poczekaj, aż nauczyciel ją rozpocznie.',
      'info',
      true,
    ],
    [
      'VOICE_CALL_ENDING',
      409,
      'Rozmowa właśnie się kończy - poproś nauczyciela o rozpoczęcie nowej.',
      'info',
      true,
    ],
    [
      'VOICE_CREATE_NOT_ALLOWED',
      403,
      'To konto nie może jeszcze rozpoczynać rozmów.',
      'info',
      false,
    ],
    ['AUTH_ERROR', 403, 'Potwierdź adres e-mail, aby korzystać z rozmów.', 'info', false],
    [
      'VOICE_EMAIL_NOT_VERIFIED',
      403,
      'Potwierdź adres e-mail, aby korzystać z rozmów.',
      'info',
      false,
    ],
    ['RATE_LIMITED', 429, 'Zbyt wiele prób - spróbuj ponownie za chwilę.', 'info', true],
    [
      'VOICE_CALL_BUSY',
      429,
      'Rozmowa jest właśnie uruchamiana - spróbuj ponownie za chwilę.',
      'info',
      true,
    ],
    [
      'VOICE_USER_LIMIT',
      429,
      'Dzienny limit rozmów dla tego konta został wyczerpany.',
      'info',
      false,
    ],
    ['VOICE_MONTHLY_LIMIT', 429, 'Limit rozmów w tym miesiącu wyczerpany.', 'info', false],
    [
      'VOICE_PROVIDER_LIMIT',
      503,
      'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
      'error',
      true,
    ],
    [
      'VOICE_PROVIDER_ERROR',
      502,
      'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
      'error',
      true,
    ],
    [
      'VOICE_PROVIDER_TIMEOUT',
      504,
      'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
      'error',
      true,
    ],
    [
      'VOICE_GUARD_UNAVAILABLE',
      503,
      'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
      'error',
      true,
    ],
    [
      'VOICE_USAGE_UNAVAILABLE',
      503,
      'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
      'error',
      true,
    ],
  ])('%s (%i) -> "%s"', async (code, status, text, kind, retry) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.createBoardCall.mockRejectedValueOnce(new AppError(`surowy ${code}`, code, status));
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('data-kind', kind);
    expect(message().textContent).toBe(text);
    expect(notice).not.toHaveTextContent('surowy');
    expect(screen.queryByText(RETRY) !== null).toBe(retry);
    // Bez ramki, bez okna, przycisk wraca do stanu początkowego - tablica działa dalej.
    expect(daily.createFrame).not.toHaveBeenCalled();
    expect(frames()).toHaveLength(0);
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
    expect(screen.getByTestId('call-button')).toHaveTextContent('Rozmowa');
    expect(consoleError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Zamknij'));
    expect(screen.queryByTestId('call-notice')).not.toBeInTheDocument();
  });

  it('401 AUTH_ERROR (sesja) nie jest brane za niepotwierdzony e-mail', async () => {
    api.createBoardCall.mockRejectedValueOnce(
      new AppError('Wymagane logowanie', ErrorCode.AUTH_ERROR, 401)
    );
    renderCall();
    clickCall();
    await screen.findByTestId('call-notice');
    expect(message().textContent).toBe('Nie udało się połączyć z rozmową. Spróbuj ponownie.');
  });

  it.each([
    ['404 (brak endpointu / tablicy)', new AppError('surowy 404', ErrorCode.NOT_FOUND, 404)],
    ['405', new AppError('surowy 405', ErrorCode.APP_ERROR, 405)],
    ['błąd sieci', new AppError('surowy brak sieci', ErrorCode.NETWORK_ERROR, 0)],
    ['nieznany kod VOICE_*', new AppError('surowy nieznany', 'VOICE_SOMETHING_NEW', 503)],
    ['nieznany kod 409', new AppError('surowy konflikt', ErrorCode.CONFLICT, 409)],
    ['500 bez kodu', new AppError('surowy 500', ErrorCode.APP_ERROR, 500)],
    ['nieznany wyjątek', new Error('surowy boom')],
  ])('%s -> ogólny komunikat (bez treści z backendu) i można ponowić', async (_name, error) => {
    api.createBoardCall.mockRejectedValueOnce(error);
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('data-kind', 'error');
    expect(message().textContent).toBe('Nie udało się połączyć z rozmową. Spróbuj ponownie.');
    expect(notice).not.toHaveTextContent('surowy');
    expect(frames()).toHaveLength(0);

    fireEvent.click(screen.getByText(RETRY));
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panel()).toBeVisible());
    expect(api.createBoardCall).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('call-notice')).not.toBeInTheDocument();
  });

  it.each([
    ['VOICE_CALL_NOT_STARTED', 409],
    ['VOICE_CALL_ENDING', 409],
    ['RATE_LIMITED', 429],
    ['VOICE_PROVIDER_ERROR', 502],
  ])(
    '%s: zero odpytywania - kolejne żądanie dopiero po kliknięciu "Spróbuj ponownie"',
    async (code, status) => {
      vi.useFakeTimers();
      try {
        api.createBoardCall.mockRejectedValueOnce(new AppError('odmowa', code, status));
        renderCall();
        clickCall();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(screen.getByTestId('call-notice')).toBeInTheDocument();
        expect(api.createBoardCall).toHaveBeenCalledTimes(1);

        // 30 minut, powrót do karty, powrót sieci - nic nie woła endpointu samo.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(15 * 60_000);
          window.dispatchEvent(new Event('focus'));
          window.dispatchEvent(new Event('online'));
          document.dispatchEvent(new Event('visibilitychange'));
          await vi.advanceTimersByTimeAsync(15 * 60_000);
        });
        expect(api.createBoardCall).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);

        fireEvent.click(screen.getByText(RETRY));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(api.createBoardCall).toHaveBeenCalledTimes(2);
        expect(daily.createFrame).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it('brak navigator.mediaDevices -> komunikat, bez wywołania API', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('data-kind', 'unsupported');
    expect(api.createBoardCall).not.toHaveBeenCalled();
    expect(daily.createFrame).not.toHaveBeenCalled();
  });

  it('createFrame rzuca (np. WebRTC wyłączone) -> komunikat zamiast wyjątku', async () => {
    daily.createFrame.mockImplementationOnce(() => {
      throw new Error('WebRTC not supported or suppressed');
    });
    renderCall();
    clickCall();
    expect(await screen.findByTestId('call-notice')).toHaveAttribute('data-kind', 'error');
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
  });

  it('join odrzucone -> komunikat i sprzątnięta instancja', async () => {
    renderCall();
    daily.createFrame.mockImplementationOnce((container: HTMLElement) => {
      const call = makeFakeCall(container);
      call.join.mockRejectedValueOnce(new Error('join failed'));
      daily.calls.push(call);
      return call;
    });
    clickCall();

    expect(await screen.findByTestId('call-notice')).toHaveAttribute('data-kind', 'error');
    await waitFor(() => expect(fakeCalls()[0].destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });

  it('zdarzenie error z Daily -> komunikat o przerwanej rozmowie i sprzątnięcie', async () => {
    renderCall();
    const call = await startCall();
    act(() => call.emit('error', { error: { type: 'connection-error' } }));

    expect(await screen.findByTestId('call-notice')).toHaveTextContent('Rozmowa została przerwana');
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });
});

describe('DailyCallProvider - token i koniec pokoju', () => {
  const sessionWith = (token: string) => ({ ...session(), token });

  it('każde dołączenie pobiera świeży token z endpointu (bez pamiętania poprzedniego)', async () => {
    const tokens = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    tokens.forEach((token) => api.createBoardCall.mockResolvedValueOnce(sessionWith(token)));
    renderCall();

    const first = await startCall();
    expect(first.join).toHaveBeenCalledWith({ url: roomUrl, token: tokens[0] });

    // Rozłączenie przyciskiem i ponowne dołączenie.
    fireEvent.click(screen.getByTestId('call-leave'));
    await waitFor(() => expect(first.destroy).toHaveBeenCalledTimes(1));
    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
    expect(api.createBoardCall).toHaveBeenCalledTimes(2);
    expect(fakeCalls()[1].join).toHaveBeenCalledWith({ url: roomUrl, token: tokens[1] });

    // Wyjście kliknięte w oknie Daily i kolejne dołączenie.
    act(() => fakeCalls()[1].emit('left-meeting'));
    await waitFor(() => expect(fakeCalls()[1].destroy).toHaveBeenCalledTimes(1));
    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(3));
    expect(api.createBoardCall).toHaveBeenCalledTimes(3);
    expect(fakeCalls()[2].join).toHaveBeenCalledWith({ url: roomUrl, token: tokens[2] });
  });

  it.each([['exp-room'], ['ejected']])(
    'wyrzucenie przy końcu pokoju (%s) -> czytelny komunikat, panel w stanie początkowym, bez błędu',
    async (type) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderCall();
      const call = await startCall();
      act(() => call.emit('joined-meeting'));

      act(() => call.emit('error', { error: { type }, errorMsg: 'Meeting has ended' }));
      // Daily po błędzie krytycznym potrafi dosłać jeszcze left-meeting - nie może nic zepsuć.
      act(() => call.emit('left-meeting'));

      const notice = await screen.findByTestId('call-notice');
      expect(notice).toHaveAttribute('data-kind', 'info');
      expect(screen.getByTestId('call-notice-message').textContent).toBe(
        'Rozmowa została zakończona (limit czasu pokoju). Nauczyciel może rozpocząć nową.'
      );
      expect(screen.queryByText('Spróbuj ponownie')).not.toBeInTheDocument();
      await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(frames()).toHaveLength(0));
      expect(panel()).not.toBeVisible();
      const button = screen.getByTestId('call-button');
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent('Rozmowa');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      // Po wyrzuceniu nic nie dołącza samo - nowa rozmowa dopiero po kliknięciu, ze świeżym tokenem.
      expect(api.createBoardCall).toHaveBeenCalledTimes(1);

      clickCall();
      await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
      expect(api.createBoardCall).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('call-notice')).not.toBeInTheDocument();
    }
  );

  it.each([
    ['exp-token', 'Czas na dołączenie do rozmowy minął. Spróbuj ponownie.', 'info'],
    ['meeting-full', 'W rozmowie jest już komplet uczestników.', 'info'],
    ['no-room', 'Rozmowa została zakończona. Nauczyciel może rozpocząć nową.', 'info'],
    ['connection-error', 'Rozmowa została przerwana. Dołącz ponownie.', 'error'],
    [undefined, 'Rozmowa została przerwana. Dołącz ponownie.', 'error'],
  ])('błąd Daily %s -> "%s" z ręcznym ponowieniem', async (type, text, kind) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCall();
    const call = await startCall();
    act(() => call.emit('error', type ? { error: { type } } : {}));

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('data-kind', kind);
    expect(screen.getByTestId('call-notice-message').textContent).toBe(text);
    expect(screen.getByText('Spróbuj ponownie')).toBeInTheDocument();
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
    expect(api.createBoardCall).toHaveBeenCalledTimes(1);
  });
});

describe('DailyCallProvider - okno rozmowy', () => {
  it('zwinięcie nie odmontowuje ramki ani nie chowa jej przez display:none', async () => {
    renderCall();
    const call = await startCall();
    const iframe = frames()[0];
    const frameBox = screen.getByTestId('call-frame');

    fireEvent.click(screen.getByTestId('call-minimize'));

    expect(panel()).toHaveAttribute('data-minimized', 'true');
    expect(frames()[0]).toBe(iframe);
    expect(iframe.isConnected).toBe(true);
    expect(screen.getByTestId('call-frame')).toBe(frameBox);
    expect(frameBox.style.display).not.toBe('none');
    expect(panel().style.display).not.toBe('none');
    expect(call.destroy).not.toHaveBeenCalled();
    expect(call.leave).not.toHaveBeenCalled();
    // Belka z wycisz / rozłącz zostaje.
    expect(screen.getByTestId('call-mute')).toBeVisible();
    expect(screen.getByTestId('call-leave')).toBeVisible();

    fireEvent.click(screen.getByTestId('call-minimize'));
    expect(panel()).toHaveAttribute('data-minimized', 'false');
    expect(frames()[0]).toBe(iframe);
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
  });

  it('wyciszenie działa po dołączeniu i idzie przez setLocalAudio', async () => {
    renderCall();
    const call = await startCall();
    expect(screen.getByTestId('call-mute')).toBeDisabled();

    act(() => call.emit('joined-meeting'));
    expect(screen.getByTestId('call-mute')).toBeEnabled();

    fireEvent.click(screen.getByTestId('call-mute'));
    expect(call.setLocalAudio).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('call-mute')).toHaveAttribute('aria-pressed', 'true');

    // Zmiana zrobiona w oknie Daily też odświeża belkę.
    act(() => call.emit('participant-updated', { participant: { local: true, audio: true } }));
    expect(screen.getByTestId('call-mute')).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Rozłącz" niszczy instancję i pozwala zacząć od nowa', async () => {
    renderCall();
    const call = await startCall();

    fireEvent.click(screen.getByTestId('call-leave'));
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
    await waitFor(() => expect(frames()).toHaveLength(0));

    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
    expect(frames()).toHaveLength(1);
  });

  it('wyjście kliknięte w oknie Daily (left-meeting) zamyka panel', async () => {
    renderCall();
    const call = await startCall();
    act(() => call.emit('left-meeting'));
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });

  it('odmontowanie niszczy instancję', async () => {
    const view = renderCall();
    const call = await startCall();
    view.unmount();
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(frames()).toHaveLength(0);
  });

  it('zmiana tablicy kończy rozmowę z poprzedniej', async () => {
    const view = renderCall(7);
    const call = await startCall();

    view.rerender(
      <DailyCallProvider boardId={8}>
        <CallButton />
      </DailyCallProvider>
    );

    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();

    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
    expect(api.createBoardCall).toHaveBeenLastCalledWith(8);
  });

  it('zmiana tablicy w trakcie łączenia nie tworzy ramki dla starej tablicy', async () => {
    let resolveCall: (value: ReturnType<typeof session>) => void = () => {};
    api.createBoardCall.mockImplementationOnce(
      () => new Promise((resolve) => (resolveCall = resolve))
    );
    const view = renderCall(7);
    clickCall();
    await waitFor(() => expect(api.createBoardCall).toHaveBeenCalledTimes(1));

    view.rerender(
      <DailyCallProvider boardId={8}>
        <CallButton />
      </DailyCallProvider>
    );
    await act(async () => {
      resolveCall(session());
      await Promise.resolve();
    });

    expect(daily.createFrame).not.toHaveBeenCalled();
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
  });

  it('destroy, które się nie kończy -> ramka usuwana po limicie czasu', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCall();
    const call = await startCall();
    call.destroy.mockImplementationOnce(() => new Promise(() => {}));

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId('call-leave'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(frames()).toHaveLength(0);
    // Druga próba destroy() - bez ramki daily-js kończy ją od razu i wyrejestrowuje instancję.
    expect(call.destroy).toHaveBeenCalledTimes(2);
  });
});

describe('CallButton', () => {
  it('poza providerem i bez liczbowego id tablicy (demo) nie renderuje nic', () => {
    const { unmount } = render(<CallButton />);
    expect(screen.queryByTestId('call-button')).not.toBeInTheDocument();
    unmount();

    renderCall(null);
    expect(screen.queryByTestId('call-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('call-panel')).not.toBeInTheDocument();
  });

  it('compact: sama ikona, opis w aria-label', () => {
    render(
      <DailyCallProvider boardId={7}>
        <CallButton compact />
      </DailyCallProvider>
    );
    const button = screen.getByTestId('call-button');
    expect(button).toHaveAttribute('aria-label', 'Rozmowa');
    expect(button).not.toHaveTextContent('Rozmowa');
  });
});
